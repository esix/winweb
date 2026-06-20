/* user32.c — H4: нативные контролы + WM_COMMAND (поверх H1..H3).
 *
 * CreateWindow("BUTTON"/"EDIT"/"STATIC", parent, ...) -> реальные HTML-элементы.
 * Клик кнопки -> WM_COMMAND(LOWORD=ctrlId, HIWORD=notify) в WndProc родителя.
 * GetWindowText/SetWindowText мостятся в value/textContent элемента.
 * Окно-canvas (Сапёр) рисуется wasm-GDI; окно-container (диалог) держит контролы.
 */
#include <emscripten.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

typedef struct { uint32_t *bits; int w, h; } DC;
typedef intptr_t (*WNDPROC)(int hwnd, int msg, int wParam, int lParam);
typedef struct { WNDPROC proc; DC buf; int has_buf, dirty, used; } Win;
static Win g_win[64];

#define WM_CREATE      0x0001
#define WM_PAINT       0x000F
#define WM_COMMAND     0x0111
#define WM_LBUTTONDOWN 0x0201
#define BN_CLICKED     0
#define CLIENT_CANVAS    0
#define CLIENT_CONTAINER 1
#define LOWORD(l) ((int)((l) & 0xFFFF))
#define HIWORD(l) ((int)(((l) >> 16) & 0xFFFF))

static inline uint32_t rgb(int r, int g, int b) { return (uint32_t)(r|(g<<8)|(b<<16)|(0xFFu<<24)); }
static void fill_rect(DC *d, int x, int y, int w, int h, uint32_t c) {
    for (int j = 0; j < h; j++) { int yy = y+j; if (yy<0||yy>=d->h) continue;
        for (int i = 0; i < w; i++) { int xx = x+i; if (xx<0||xx>=d->w) continue; d->bits[yy*d->w+xx]=c; } }
}
static void bevel(DC *d, int x, int y, int w, int h, uint32_t lt, uint32_t dk) {
    fill_rect(d,x,y,w,1,lt); fill_rect(d,x,y,1,h,lt);
    fill_rect(d,x,y+h-1,w,1,dk); fill_rect(d,x+w-1,y,1,h,dk);
}

/* --- мост в TS --- */
EM_JS(int, host_create_window, (const char *title, int x, int y, int w, int h, int type), {
    return globalThis.winwebHost.createWindow(UTF8ToString(title), x, y, w, h, type);
});
EM_JS(int, host_create_control, (const char *cls, int parent, const char *text, int x, int y, int w, int h, int ctrlId), {
    return globalThis.winwebHost.createControl(UTF8ToString(cls), parent, UTF8ToString(text), x, y, w, h, ctrlId);
});
EM_JS(void, host_set_text, (int hwnd, const char *s), {
    globalThis.winwebHost.setWindowText(hwnd, UTF8ToString(s));
});
EM_JS(int, host_get_text, (int hwnd, char *buf, int maxlen), {
    var s = globalThis.winwebHost.getWindowText(hwnd) || "";
    stringToUTF8(s, buf, maxlen);
    return lengthBytesUTF8(s);
});
EM_JS(void, host_present, (int id, int ptr, int w, int h), {
    var ctx = globalThis.winwebHost.ctx(id); if (!ctx) return;
    var view = new Uint8ClampedArray(HEAPU8.buffer, ptr >>> 0, w*h*4);
    ctx.putImageData(new ImageData(view, w, h), 0, 0);
});

/* --- user32-функции --- */
static DC  *BeginPaint(int id) { return &g_win[id].buf; }
static void EndPaint(int id)   { host_present(id, (int)(intptr_t)g_win[id].buf.bits, g_win[id].buf.w, g_win[id].buf.h); }
static void InvalidateRect(int id) { g_win[id].dirty = 1; }
static int  CreateControl(const char *cls, int parent, const char *text, int x, int y, int w, int h, int ctrlId) {
    return host_create_control(cls, parent, text, x, y, w, h, ctrlId);
}
static void SetWindowText(int hwnd, const char *s) { host_set_text(hwnd, s); }
static int  GetWindowText(int hwnd, char *buf, int maxlen) { return host_get_text(hwnd, buf, maxlen); }

EMSCRIPTEN_KEEPALIVE
intptr_t wm_dispatch(int id, int msg, int wParam, int lParam) {
    if (id <= 0 || id >= 64 || !g_win[id].used || !g_win[id].proc) return 0;
    intptr_t r = g_win[id].proc(id, msg, wParam, lParam);
    if (g_win[id].dirty) { g_win[id].proc(id, WM_PAINT, 0, 0); g_win[id].dirty = 0; }
    return r;
}

static int create_window(const char *title, int x, int y, int w, int h, int ct, WNDPROC proc) {
    int id = host_create_window(title, x, y, w, h, ct);
    g_win[id].used = 1; g_win[id].proc = proc; g_win[id].has_buf = 0; g_win[id].dirty = 0;
    if (ct == CLIENT_CANVAS) {
        g_win[id].buf.w = w; g_win[id].buf.h = h;
        g_win[id].buf.bits = (uint32_t*)malloc((size_t)w*h*4);
        g_win[id].has_buf = 1;
    }
    if (proc) {
        proc(id, WM_CREATE, 0, 0);
        if (g_win[id].has_buf) proc(id, WM_PAINT, 0, 0);
    }
    return id;
}

/* ===== окно-canvas: «Сапёр» (как в H2) ===== */
#define GN 8
#define CELL 24
#define OFF 6
static int g_grid[GN][GN];

static intptr_t mine_proc(int id, int msg, int wParam, int lParam) {
    (void)wParam;
    switch (msg) {
        case WM_CREATE:
            for (int r = 0; r < GN; r++) for (int c = 0; c < GN; c++) g_grid[r][c] = 0;
            return 0;
        case WM_LBUTTONDOWN: {
            int c = (LOWORD(lParam) - OFF) / CELL, r = (HIWORD(lParam) - OFF) / CELL;
            if (r >= 0 && r < GN && c >= 0 && c < GN) { g_grid[r][c] = 1; InvalidateRect(id); }
            return 0;
        }
        case WM_PAINT: {
            DC *d = BeginPaint(id);
            for (int i = 0; i < d->w*d->h; i++) d->bits[i] = rgb(192,192,192);
            bevel(d, 2,2, d->w-4, d->h-4, rgb(128,128,128), rgb(255,255,255));
            for (int r = 0; r < GN; r++) for (int c = 0; c < GN; c++) {
                int cx = OFF + c*CELL, cy = OFF + r*CELL, s = CELL - 2;
                if (!g_grid[r][c]) { fill_rect(d,cx,cy,s,s,rgb(192,192,192)); bevel(d,cx,cy,s,s,rgb(255,255,255),rgb(128,128,128)); }
                else { fill_rect(d,cx,cy,s,s,rgb(208,208,208)); bevel(d,cx,cy,s,s,rgb(128,128,128),rgb(220,220,220));
                       fill_rect(d, cx+s/2-3, cy+s/2-3, 6, 6, ((r+c)&1)?rgb(0,0,200):rgb(0,140,0)); }
            }
            EndPaint(id);
            return 0;
        }
    }
    return 0;
}

/* ===== окно-container: диалог с нативными контролами (H4) ===== */
#define ID_EDIT 100
#define ID_ADD  101
#define ID_CLR  102
#define ID_OUT  103
static int  g_edit, g_out;
static char g_acc[1024];

static intptr_t dlg_proc(int id, int msg, int wParam, int lParam) {
    (void)lParam;
    switch (msg) {
        case WM_CREATE:
            CreateControl("STATIC", id, "Enter text, then click Add:", 12, 10, 264, 16, 0);
            g_edit = CreateControl("EDIT",   id, "",        12,  32, 188, 22, ID_EDIT);
            CreateControl("BUTTON", id, "Add",   210,  31, 64, 24, ID_ADD);
            CreateControl("BUTTON", id, "Clear", 210,  60, 64, 24, ID_CLR);
            CreateControl("STATIC", id, "Items:",  12,  64, 80, 16, 0);
            g_out  = CreateControl("STATIC", id, "(empty)", 12, 84, 264, 92, ID_OUT);
            return 0;
        case WM_COMMAND: {
            int cid = LOWORD(wParam);
            if (cid == ID_ADD) {
                char buf[128];
                GetWindowText(g_edit, buf, sizeof buf);
                if (buf[0]) {
                    if (g_acc[0]) strncat(g_acc, "\n", sizeof g_acc - strlen(g_acc) - 1);
                    strncat(g_acc, buf, sizeof g_acc - strlen(g_acc) - 1);
                    SetWindowText(g_out, g_acc);
                    SetWindowText(g_edit, "");
                }
            } else if (cid == ID_CLR) {
                g_acc[0] = 0;
                SetWindowText(g_out, "(empty)");
            }
            return 0;
        }
    }
    return 0;
}

int main(void) {
    create_window("Minesweeper", 60, 70, OFF*2 + GN*CELL, OFF*2 + GN*CELL, CLIENT_CANVAS, mine_proc);
    create_window("Controls",   320, 70, 290, 188, CLIENT_CONTAINER, dlg_proc);
    return 0;
}
