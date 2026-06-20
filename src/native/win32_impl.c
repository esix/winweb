/* win32_impl.c — реализация windows.h поверх DOM-WM + GDI-объектной модели (gdi.ts).
 * HDC/HGDIOBJ/HBITMAP/HFONT/HPEN/HBRUSH — целочисленные хендлы из gdi.ts.
 * GetMessage блокирует через emscripten_sleep + ASYNCIFY (один модуль).
 */
#include <windows.h>
#include <string.h>
#include <emscripten.h>

/* ---- DOM-окно ---- */
EM_JS(int, host_create_window, (const char *title, int x, int y, int w, int h), {
    return globalThis.winwebHost.createWindow(UTF8ToString(title), x, y, w, h, 0 /*canvas*/);
});
EM_JS(void, js_clear, (int id, int cref), {
    var ctx = globalThis.winwebHost.ctx(id); if (!ctx) return;
    ctx.fillStyle = 'rgb(' + (cref & 255) + ',' + ((cref >> 8) & 255) + ',' + ((cref >> 16) & 255) + ')';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
});

/* ---- мост к gdi.ts ---- */
EM_JS(int,  g_windowdc,   (int id),                         { return globalThis.winwebHost.gdi.windowDC(id); });
EM_JS(int,  g_brushcolor, (int h),                          { return globalThis.winwebHost.gdi.brushColorOf(h); });
EM_JS(int,  g_ccdc,       (void),                           { return globalThis.winwebHost.gdi.createCompatibleDC(); });
EM_JS(int,  g_ccbmp,      (int w, int h),                   { return globalThis.winwebHost.gdi.createCompatibleBitmap(w, h); });
EM_JS(int,  g_pen,        (int s, int w, int c),            { return globalThis.winwebHost.gdi.createPen(s, w, c); });
EM_JS(int,  g_brush,      (int c),                          { return globalThis.winwebHost.gdi.createSolidBrush(c); });
EM_JS(int,  g_font,       (int h, int w, int it),           { return globalThis.winwebHost.gdi.createFont(h, w, it); });
EM_JS(int,  g_stock,      (int o),                          { return globalThis.winwebHost.gdi.getStockObject(o); });
EM_JS(int,  g_syscb,      (int i),                          { return globalThis.winwebHost.gdi.getSysColorBrush(i); });
EM_JS(int,  g_select,     (int dc, int o),                  { return globalThis.winwebHost.gdi.selectObject(dc, o); });
EM_JS(void, g_delobj,     (int h),                          { globalThis.winwebHost.gdi.deleteObject(h); });
EM_JS(void, g_deldc,      (int h),                          { globalThis.winwebHost.gdi.deleteDC(h); });
EM_JS(void, g_bitblt,     (int d,int dx,int dy,int w,int h,int s,int sx,int sy), { globalThis.winwebHost.gdi.bitBlt(d,dx,dy,w,h,s,sx,sy); });
EM_JS(void, g_fillrect,   (int dc,int l,int t,int r,int b,int br), { globalThis.winwebHost.gdi.fillRect(dc,l,t,r,b,br); });
EM_JS(void, g_rect,       (int dc,int l,int t,int r,int b), { globalThis.winwebHost.gdi.rectangle(dc,l,t,r,b); });
EM_JS(void, g_ellipse,    (int dc,int l,int t,int r,int b), { globalThis.winwebHost.gdi.ellipse(dc,l,t,r,b); });
EM_JS(void, g_arc,        (int dc,int l,int t,int r,int b,int xs,int ys,int xe,int ye), { globalThis.winwebHost.gdi.arc(dc,l,t,r,b,xs,ys,xe,ye); });
EM_JS(void, g_polygon,    (int dc,int ptr,int n),           { globalThis.winwebHost.gdi.polygon(dc,ptr,n); });
EM_JS(void, g_moveto,     (int dc,int x,int y),             { globalThis.winwebHost.gdi.moveTo(dc,x,y); });
EM_JS(void, g_lineto,     (int dc,int x,int y),             { globalThis.winwebHost.gdi.lineTo(dc,x,y); });
EM_JS(void, g_setpixel,   (int dc,int x,int y,int c),       { globalThis.winwebHost.gdi.setPixel(dc,x,y,c); });
EM_JS(void, g_settextcol, (int dc,int c),                  { globalThis.winwebHost.gdi.setTextColor(dc,c); });
EM_JS(void, g_setbkcol,   (int dc,int c),                  { globalThis.winwebHost.gdi.setBkColor(dc,c); });
EM_JS(void, g_setbkmode,  (int dc,int m),                  { globalThis.winwebHost.gdi.setBkMode(dc,m); });
EM_JS(void, g_drawedge,   (int dc,int l,int t,int r,int b,int e), { globalThis.winwebHost.gdi.drawEdge(dc,l,t,r,b,e); });
EM_JS(void, g_text,       (int dc, const char* s, int x, int y), { globalThis.winwebHost.gdi.textOut(dc, x, y, UTF8ToString(s)); });
EM_JS(void, g_textw, (int dc, int x, int y, int ptr, int len), {
    var s='', base=ptr>>1;
    if (len < 0) { for (var i=0;;i++){ var c=HEAPU16[base+i]; if(!c) break; s+=String.fromCharCode(c);} }
    else { for (var i=0;i<len;i++) s+=String.fromCharCode(HEAPU16[base+i]); }
    globalThis.winwebHost.gdi.textOut(dc, x, y, s);
});
EM_JS(int, g_textextw, (int dc, int ptr, int len, int sizeptr), {
    var s='', base=ptr>>1;
    if (len < 0) { for (var i=0;;i++){ var c=HEAPU16[base+i]; if(!c) break; s+=String.fromCharCode(c);} }
    else { for (var i=0;i<len;i++) s+=String.fromCharCode(HEAPU16[base+i]); }
    var wh = globalThis.winwebHost.gdi.textExtent(dc, s);
    HEAP32[sizeptr>>2]=wh[0]; HEAP32[(sizeptr>>2)+1]=wh[1]; return 1;
});

/* контролы + текст + параметры запуска + сохранение (для notepad) */
EM_JS(int, host_create_control, (const char *cls, int parent, const char *text, int x, int y, int w, int h, int ctrlId, int ml), {
    return globalThis.winwebHost.createControl(UTF8ToString(cls), parent, UTF8ToString(text), x, y, w, h, ctrlId, ml);
});
EM_JS(void, host_set_text, (int h, const char *s), { globalThis.winwebHost.setWindowText(h, UTF8ToString(s)); });
EM_JS(int,  host_get_text, (int h, char *buf, int max), {
    var s = globalThis.winwebHost.getWindowText(h) || ""; stringToUTF8(s, buf, max); return lengthBytesUTF8(s);
});
EM_JS(int,  host_launch_text, (char *buf, int max), {
    var s = globalThis.winwebHost.launchText || ""; stringToUTF8(s, buf, max); return lengthBytesUTF8(s);
});
EM_JS(int,  host_launch_path, (char *buf, int max), {
    var s = globalThis.winwebHost.launchPath || ""; stringToUTF8(s, buf, max); return lengthBytesUTF8(s);
});
EM_JS(void, host_save_file, (const char *path, const char *text), {
    if (globalThis.winwebHost.saveFile) globalThis.winwebHost.saveFile(UTF8ToString(path), UTF8ToString(text));
});
/* ---- меню ---- */
EM_JS(int,  host_menu_create, (void), { return globalThis.winwebHost.menuCreate(); });
EM_JS(void, host_menu_append, (int menu, int flags, int id, const char *text), {
    globalThis.winwebHost.menuAppend(menu, flags, id, UTF8ToString(text));
});
EM_JS(void, host_menu_set, (int win, int menu), { globalThis.winwebHost.menuSet(win, menu); });
EM_JS(void, host_destroy_window, (int win), { globalThis.winwebHost.destroyWindow(win); });
/* prompt + асинхронная загрузка файла в EDIT (по хэндлу контрола) */
EM_JS(int,  host_prompt, (const char *title, const char *def, char *buf, int max), {
    var s = globalThis.prompt(UTF8ToString(title), UTF8ToString(def)) || "";
    stringToUTF8(s, buf, max); return lengthBytesUTF8(s);
});
EM_JS(void, host_load, (int edit, const char *path), {
    if (globalThis.winwebHost.loadInto) globalThis.winwebHost.loadInto(edit, UTF8ToString(path));
});
/* ---- ресурсы (.ico/.bmp из .rc, вшитые в .wasm) ---- */
EM_JS(int,  host_load_image, (int ptr, int len, const char *mime), { return globalThis.winwebHost.gdi.loadImageRes(ptr, len, UTF8ToString(mime)); });
EM_JS(void, host_draw_icon,  (int dc, int x, int y, int ic),       { globalThis.winwebHost.gdi.drawIcon(dc, x, y, ic); });
EM_JS(void, host_set_window_icon, (int win, int ic),               { globalThis.winwebHost.setWindowIcon(win, ic); });
/* ---- консоль ---- */
EM_JS(int,  host_con_open,  (void),                       { return globalThis.winwebHost.conOpen(); });
EM_JS(void, host_con_write, (int id, const char *s, int n), { globalThis.winwebHost.conWrite(id, UTF8ToString(s, n)); });
EM_JS(void, host_con_title, (int id, const char *s),      { globalThis.winwebHost.conTitle(id, UTF8ToString(s)); });
EM_JS(void, host_con_clear, (int id),                     { globalThis.winwebHost.conClear(id); });
EM_JS(int,  host_con_getline, (int id, char *buf, int max), {   /* -1 нет строки, -2 консоль закрыта */
    var line = globalThis.winwebHost.conTryLine(id);
    if (line === false) return -2;
    if (line === null) return -1;
    stringToUTF8(line, buf, max); return lengthBytesUTF8(line);
});
/* ---- мост к VFS для cmd (асинхронно -> опрос) ---- */
EM_JS(void, host_vfs_start, (int op, const char *path), { globalThis.winwebHost.vfsStart(op, UTF8ToString(path)); });
EM_JS(int,  host_vfs_poll,  (char *buf, int max), {
    var r = globalThis.winwebHost.vfsPoll();
    if (r === null) return -1;
    stringToUTF8(r, buf, max); return lengthBytesUTF8(r);
});
/* запуск программы из cmd: 1=запущена(.wasm), 2=PE(.exe, не выполнить), 0=не найдена, -1=ждём */
EM_JS(void, host_exec_start, (const char *path), { globalThis.winwebHost.execStart(UTF8ToString(path)); });
EM_JS(int,  host_exec_poll,  (void),             { return globalThis.winwebHost.execPoll(); });

/* ресурсы (.ico/.bmp из .rc) генерит build-rc.mjs; данные static (модуль-локальны, не сливаются
   через GOT), доступ через per-handle функции (weak: у приложения может не быть ресурсов). */
typedef struct { int id; const char *mime; const unsigned char *data; int len; } WinwebRes;
extern const WinwebRes* winweb_res_table(void) __attribute__((weak));
extern int winweb_res_n(void) __attribute__((weak));

/* ---- реестр классов/окон ---- */
typedef struct { char name[64]; WNDPROC proc; int bgBrush; int app; int icon; } WClass;
typedef struct { WNDPROC proc; COLORREF bg; int w, h, used, app; } Wnd;
static WClass g_cls[16]; static int g_ncls = 0;
static Wnd    g_wnd[64];

static int  hid(HWND h){ return (int)(intptr_t)h; }
static HWND mkh(int id){ return (HWND)(intptr_t)id; }

/* ---- пер-аппные очереди сообщений (D3: несколько приложений одновременно) ---- */
#define QN 1024
#define MAXAPP 16
typedef struct { MSG q[QN]; int head, tail, quit, quitcode, used; const WinwebRes *res; int res_n; int con; } AppCtx;
static AppCtx g_app[MAXAPP];
static int g_curApp = 0;     /* индекс выполняющейся сейчас фибры-приложения */

/* таблица ресурсов текущего приложения: динамика — из загруженного side-модуля (g_app[].res,
   заполняется в winweb_run через dlsym); статика — weak-символ из этого же линка. */
static const WinwebRes* cur_res(int *n){
    if (g_app[g_curApp].res) { *n = g_app[g_curApp].res_n; return g_app[g_curApp].res; }   // динамика: из side-модуля
    if (&winweb_res_table) { *n = winweb_res_n(); return winweb_res_table(); }              // статика: тот же линк
    *n = 0; return 0;
}

static void q_push_app(int app, HWND h, UINT m, WPARAM w, LPARAM l){
    if(app<0||app>=MAXAPP) return;
    AppCtx *a=&g_app[app]; int n=(a->tail+1)%QN; if(n==a->head) return;
    a->q[a->tail].hwnd=h; a->q[a->tail].message=m; a->q[a->tail].wParam=w; a->q[a->tail].lParam=l; a->tail=n;
}
/* какому приложению принадлежит окно (маршрутизация DOM-событий в нужную очередь) */
static int win_app(int id){ return (id>0 && id<64 && g_wnd[id].used) ? g_wnd[id].app : g_curApp; }

EMSCRIPTEN_KEEPALIVE
void wm_post(int id,int msg,int wParam,int lParam){ q_push_app(win_app(id), mkh(id),(UINT)msg,(WPARAM)wParam,(LPARAM)lParam); }

/* ---- user32 ---- */
ATOM RegisterClass(const WNDCLASS *wc){
    if(g_ncls>=16) return 0;
    strncpy(g_cls[g_ncls].name, wc->lpszClassName, 63);
    g_cls[g_ncls].proc = wc->lpfnWndProc;
    g_cls[g_ncls].bgBrush = (int)(intptr_t)wc->hbrBackground;
    g_cls[g_ncls].app = g_curApp;     /* класс принадлежит регистрирующему приложению */
    g_cls[g_ncls].icon = (int)(intptr_t)wc->hIcon;   /* wc.hIcon (из LoadIcon) -> значок в заголовке */
    g_ncls++; return 1;
}
static int is_ctl(LPCTSTR c){ return !strcmp(c,"EDIT")||!strcmp(c,"BUTTON")||!strcmp(c,"STATIC")||!strcmp(c,"LISTBOX"); }

HWND CreateWindowEx(DWORD ex,LPCTSTR cls,LPCTSTR name,DWORD style,int x,int y,int w,int h,HWND parent,HMENU menu,HINSTANCE inst,LPVOID param){
    (void)ex;(void)inst;(void)param;
    if (parent && is_ctl(cls)) {                 /* дочерний контрол: EDIT/BUTTON/STATIC */
        int ml = (!strcmp(cls,"EDIT") && (style & ES_MULTILINE)) ? 1 : 0;
        int ch = host_create_control(cls, hid(parent), name ? name : "", x, y, w, h, (int)(intptr_t)menu, ml);
        return mkh(ch);
    }
    (void)style;
    WClass *k=NULL; for(int i=0;i<g_ncls;i++) if(g_cls[i].app==g_curApp && strcmp(g_cls[i].name,cls)==0){ k=&g_cls[i]; break; }
    if(!k) return NULL;
    if(w==CW_USEDEFAULT||w<=0) w=300; if(h==CW_USEDEFAULT||h<=0) h=300;
    int id=host_create_window(name?name:"", x<0?40:x, y<0?40:y, w, h);
    g_wnd[id].proc=k->proc; g_wnd[id].w=w; g_wnd[id].h=h; g_wnd[id].used=1; g_wnd[id].app=g_curApp;
    g_wnd[id].bg = k->bgBrush ? (COLORREF)g_brushcolor(k->bgBrush) : 0xC0C0C0;
    if(k->icon) host_set_window_icon(id, k->icon);   /* значок класса -> заголовок окна */
    HWND hwnd=mkh(id);
    k->proc(hwnd, WM_CREATE, 0, 0);
    return hwnd;
}
BOOL ShowWindow(HWND h,int c){ (void)h;(void)c; return TRUE; }
BOOL UpdateWindow(HWND h){ q_push_app(win_app(hid(h)), h, WM_PAINT, 0, 0); return TRUE; }
BOOL InvalidateRect(HWND h,const RECT *r,BOOL e){ (void)r;(void)e;
    int app=win_app(hid(h)); AppCtx *a=&g_app[app];
    for(int i=a->head;i!=a->tail;i=(i+1)%QN) if(a->q[i].message==WM_PAINT&&a->q[i].hwnd==h) return TRUE;
    q_push_app(app, h, WM_PAINT, 0, 0); return TRUE;
}
BOOL GetMessage(LPMSG msg,HWND h,UINT a,UINT b){ (void)h;(void)a;(void)b;
    int me = g_curApp;                 /* владелец цикла; локал на стеке -> переживает JSPI-приостановку */
    AppCtx *ac = &g_app[me];
    for(;;){
        if(ac->head!=ac->tail){ *msg=ac->q[ac->head]; ac->head=(ac->head+1)%QN; return msg->message!=WM_QUIT; }
        if(ac->quit){ msg->hwnd=NULL; msg->message=WM_QUIT; msg->wParam=ac->quitcode; msg->lParam=0; return FALSE; }
        emscripten_sleep(16);
        g_curApp = me;                 /* восстановить «текущее» после пробуждения (другие фибры могли сменить) */
    }
}
BOOL    TranslateMessage(const MSG *m){ (void)m; return FALSE; }
LRESULT DispatchMessage(const MSG *m){ int id=hid(m->hwnd); if(id<=0||id>=64||!g_wnd[id].used) return 0; g_curApp=g_wnd[id].app; return g_wnd[id].proc(m->hwnd,m->message,m->wParam,m->lParam); }
LRESULT DefWindowProc(HWND h,UINT msg,WPARAM w,LPARAM l){ (void)h;(void)msg;(void)w;(void)l; return 0; }
void    PostQuitMessage(int c){ g_app[g_curApp].quit=1; g_app[g_curApp].quitcode=c; }
BOOL    GetClientRect(HWND h,LPRECT r){ int id=hid(h); r->left=0;r->top=0;r->right=g_wnd[id].w;r->bottom=g_wnd[id].h; return TRUE; }
HICON   LoadIcon(HINSTANCE i,LPCTSTR n){ (void)i;
    int cnt, id=(int)(intptr_t)n; const WinwebRes *t = cur_res(&cnt);
    for (int k=0;k<cnt;k++) if (t[k].id==id) return (HICON)(intptr_t)host_load_image((int)(intptr_t)t[k].data, t[k].len, t[k].mime);
    return NULL;
}
HBITMAP LoadBitmap(HINSTANCE i,LPCTSTR n){ (void)i;
    int cnt, id=(int)(intptr_t)n; const WinwebRes *t = cur_res(&cnt);
    for (int k=0;k<cnt;k++) if (t[k].id==id) return (HBITMAP)(intptr_t)host_load_image((int)(intptr_t)t[k].data, t[k].len, t[k].mime);
    return NULL;
}
BOOL    DrawIcon(HDC dc,int x,int y,HICON ic){ host_draw_icon((int)(intptr_t)dc, x, y, (int)(intptr_t)ic); return TRUE; }
HCURSOR LoadCursor(HINSTANCE i,LPCTSTR n){ (void)i;(void)n; return NULL; }
HCURSOR SetCursor(HCURSOR c){ (void)c; return NULL; }
int     ShowCursor(BOOL b){ (void)b; return 0; }
int     MessageBox(HWND h,LPCTSTR t,LPCTSTR c,UINT y){ (void)h;(void)t;(void)c;(void)y; return 0; }
BOOL    SetWindowText(HWND h, LPCSTR s){ host_set_text(hid(h), s); return TRUE; }
int     GetWindowText(HWND h, LPSTR buf, int max){ return host_get_text(hid(h), buf, max); }

/* ---- gdi32 (handle-based) ---- */
HDC      BeginPaint(HWND h,LPPAINTSTRUCT ps){ int id=hid(h); js_clear(id,g_wnd[id].bg); int dc=g_windowdc(id);
    ps->hdc=(HDC)(intptr_t)dc; ps->fErase=TRUE; ps->rcPaint.left=0;ps->rcPaint.top=0;ps->rcPaint.right=g_wnd[id].w;ps->rcPaint.bottom=g_wnd[id].h; return ps->hdc; }
BOOL     EndPaint(HWND h,const PAINTSTRUCT *ps){ (void)h; g_deldc((int)(intptr_t)ps->hdc); return TRUE; }
HDC      GetDC(HWND h){ return (HDC)(intptr_t)g_windowdc(hid(h)); }
int      ReleaseDC(HWND h,HDC dc){ (void)h; g_deldc((int)(intptr_t)dc); return 1; }
HGDIOBJ  GetStockObject(int o){ return (HGDIOBJ)(intptr_t)g_stock(o); }
HBRUSH   GetSysColorBrush(int i){ return (HBRUSH)(intptr_t)g_syscb(i); }
HBRUSH   CreateSolidBrush(COLORREF c){ return (HBRUSH)(intptr_t)g_brush((int)c); }
HPEN     CreatePen(int s,int w,COLORREF c){ return (HPEN)(intptr_t)g_pen(s,w,(int)c); }
HFONT    CreateFontW(int ch,int cw,int e,int o,int weight,DWORD it,DWORD u,DWORD st,DWORD cs,DWORD op,DWORD cp,DWORD q,DWORD pf,LPCWSTR f){
    (void)cw;(void)e;(void)o;(void)u;(void)st;(void)cs;(void)op;(void)cp;(void)q;(void)pf;(void)f;
    return (HFONT)(intptr_t)g_font(ch, weight, (int)it); }
HDC      CreateCompatibleDC(HDC dc){ (void)dc; return (HDC)(intptr_t)g_ccdc(); }
HBITMAP  CreateCompatibleBitmap(HDC dc,int w,int h){ (void)dc; return (HBITMAP)(intptr_t)g_ccbmp(w,h); }
BOOL     BitBlt(HDC d,int dx,int dy,int w,int h,HDC s,int sx,int sy,DWORD rop){ (void)rop; g_bitblt((int)(intptr_t)d,dx,dy,w,h,(int)(intptr_t)s,sx,sy); return TRUE; }
BOOL     DeleteDC(HDC h){ g_deldc((int)(intptr_t)h); return TRUE; }
BOOL     DeleteObject(HGDIOBJ h){ g_delobj((int)(intptr_t)h); return TRUE; }
HGDIOBJ  SelectObject(HDC dc,HGDIOBJ o){ return (HGDIOBJ)(intptr_t)g_select((int)(intptr_t)dc,(int)(intptr_t)o); }
int      FillRect(HDC dc,const RECT *r,HBRUSH br){ g_fillrect((int)(intptr_t)dc,r->left,r->top,r->right,r->bottom,(int)(intptr_t)br); return 1; }
BOOL     Rectangle(HDC dc,int l,int t,int r,int b){ g_rect((int)(intptr_t)dc,l,t,r,b); return TRUE; }
BOOL     Ellipse(HDC dc,int l,int t,int r,int b){ g_ellipse((int)(intptr_t)dc,l,t,r,b); return TRUE; }
BOOL     Arc(HDC dc,int l,int t,int r,int b,int xs,int ys,int xe,int ye){ g_arc((int)(intptr_t)dc,l,t,r,b,xs,ys,xe,ye); return TRUE; }
BOOL     Polygon(HDC dc,const POINT *p,int n){ g_polygon((int)(intptr_t)dc,(int)(intptr_t)p,n); return TRUE; }
BOOL     MoveToEx(HDC dc,int x,int y,LPPOINT old){ if(old){old->x=0;old->y=0;} g_moveto((int)(intptr_t)dc,x,y); return TRUE; }
BOOL     LineTo(HDC dc,int x,int y){ g_lineto((int)(intptr_t)dc,x,y); return TRUE; }
COLORREF SetPixel(HDC dc,int x,int y,COLORREF c){ g_setpixel((int)(intptr_t)dc,x,y,(int)c); return c; }
COLORREF SetTextColor(HDC dc,COLORREF c){ g_settextcol((int)(intptr_t)dc,(int)c); return c; }
COLORREF SetBkColor(HDC dc,COLORREF c){ g_setbkcol((int)(intptr_t)dc,(int)c); return c; }
int      SetBkMode(HDC dc,int m){ g_setbkmode((int)(intptr_t)dc,m); return m; }
DWORD    SetLayout(HDC dc,DWORD l){ (void)dc;(void)l; return 0; }
DWORD    GetLayout(HDC dc){ (void)dc; return 0; }
BOOL     DrawEdge(HDC dc,LPRECT r,UINT edge,UINT flags){ (void)flags; g_drawedge((int)(intptr_t)dc,r->left,r->top,r->right,r->bottom,(int)edge); return TRUE; }
BOOL     TextOut(HDC dc,int x,int y,LPCTSTR s,int len){ (void)len; g_text((int)(intptr_t)dc,s,x,y); return TRUE; }
BOOL     TextOutW(HDC dc,int x,int y,LPCWSTR s,int len){ g_textw((int)(intptr_t)dc,x,y,(int)(intptr_t)s,len); return TRUE; }
BOOL     GetTextExtentPoint32W(HDC dc,LPCWSTR s,int len,LPSIZE sz){ return g_textextw((int)(intptr_t)dc,(int)(intptr_t)s,len,(int)(intptr_t)sz); }

/* ---- timer: реальный JS-интервал, постит WM_TIMER в окно ---- */
EM_JS(void, host_set_timer,  (int hwnd, int id, int ms), { globalThis.winwebHost.setTimer(hwnd, id, ms); });
EM_JS(void, host_kill_timer, (int hwnd, int id),         { globalThis.winwebHost.killTimer(hwnd, id); });
UINT_PTR SetTimer(HWND h,UINT_PTR id,UINT el,TIMERPROC p){ (void)p; host_set_timer(hid(h),(int)id,(int)el); return id?id:1; }
BOOL     KillTimer(HWND h,UINT_PTR id){ host_kill_timer(hid(h),(int)id); return TRUE; }

/* ---- utilities.c заглушки ---- */
int       GetSystemMetrics(int i){ switch(i){case 0:return 1280;case 1:return 720;case 4:return 24;case 15:return 20;case 5:case 6:return 1;default:return 0;} }
ULONGLONG GetTickCount64(void){ return (ULONGLONG)emscripten_get_now(); }
BOOL      CheckMenuItem(HMENU m,UINT id,UINT f){ (void)m;(void)id;(void)f; return 0; }
HMENU     CreateMenu(void){ return (HMENU)(intptr_t)host_menu_create(); }
HMENU     CreatePopupMenu(void){ return (HMENU)(intptr_t)host_menu_create(); }
BOOL      AppendMenu(HMENU m,UINT f,UINT_PTR id,LPCSTR text){ host_menu_append((int)(intptr_t)m,(int)f,(int)id,text?text:""); return TRUE; }
BOOL      SetMenu(HWND h,HMENU m){ host_menu_set(hid(h),(int)(intptr_t)m); return TRUE; }
BOOL      DestroyWindow(HWND h){ host_destroy_window(hid(h)); return TRUE; }

/* ---- консоль ---- */
BOOL   AllocConsole(void){ g_app[g_curApp].con = host_con_open(); return TRUE; }
HANDLE GetStdHandle(DWORD n){ (void)n; return mkh(g_app[g_curApp].con); }
BOOL   SetConsoleTitleA(LPCSTR t){ host_con_title(g_app[g_curApp].con, t?t:""); return TRUE; }
BOOL   WriteConsoleA(HANDLE h, const void *buf, DWORD len, DWORD *written, void *r){ (void)r;
    host_con_write(hid(h), (const char*)buf, (int)len); if(written)*written=len; return TRUE; }
BOOL   ReadConsoleA(HANDLE h, void *buf, DWORD len, DWORD *read, void *r){ (void)r;
    int id=hid(h), n;
    for(;;){ n=host_con_getline(id,(char*)buf,(int)len); if(n>=0){ if(read)*read=(DWORD)n; return TRUE; }
             if(n==-2){ if(read)*read=0; return FALSE; } emscripten_sleep(16); }   /* блокируемся через JSPI */
}
/* РЕАЛЬНЫЕ C-обёртки в рантайме (side-модуль cmd импортирует их, а не EM_JS — те не в dynsym) */
EMSCRIPTEN_KEEPALIVE int winweb_vfs(int op, const char *path, char *buf, int max){
    host_vfs_start(op, path); int n; while((n=host_vfs_poll(buf,max))<0) emscripten_sleep(8); return n;   /* блок через JSPI */
}
EMSCRIPTEN_KEEPALIVE void winweb_con_clear(int id){ host_con_clear(id); }
EMSCRIPTEN_KEEPALIVE int winweb_exec(const char *path){
    host_exec_start(path); int r; while((r=host_exec_poll())<0) emscripten_sleep(8); return r;
}
/* cc: компиляция C->wasm и запуск, вывод в консоль con (блок через JSPI) */
EM_JS(void, host_cc_start, (const char *path, int con), { globalThis.winwebHost.ccStart(UTF8ToString(path), con); });
EM_JS(int,  host_cc_poll,  (void),                      { return globalThis.winwebHost.ccPoll(); });
EMSCRIPTEN_KEEPALIVE int winweb_cc(const char *path, int con){
    host_cc_start(path, con); int r; while((r=host_cc_poll())<0) emscripten_sleep(8); return r;
}
UINT      GetDlgItemInt(HWND h,int id,BOOL *t,BOOL s){ (void)h;(void)id;(void)s; if(t)*t=FALSE; return 0; }
int       LoadString(HINSTANCE i,UINT id,LPSTR buf,int max){ (void)i;(void)id; if(max>0)buf[0]=0; return 0; }
void      ShellAbout(HWND h,LPCSTR a,LPCSTR b,HICON i){ (void)h;(void)a;(void)b;(void)i; }

/* ---- точка входа ---- */
#ifdef WINWEB_DYNAMIC
/* Динамический рантайм (MAIN_MODULE): приложение — отдельный SIDE_MODULE,
   грузится в рантайм во время выполнения; WinMain находим через dlsym.
   winweb_run помечен JSPI-promising-экспортом — блокирующий цикл GetMessage
   приостанавливается/возобновляется через границу модулей. */
#include <dlfcn.h>
EMSCRIPTEN_KEEPALIVE
int winweb_run(const char *path){
    /* выделяем слот приложения (своя очередь + quit) */
    int slot=-1; for(int i=0;i<MAXAPP;i++) if(!g_app[i].used){ slot=i; break; }
    if(slot<0) return -2;
    AppCtx *a=&g_app[slot]; a->head=a->tail=a->quit=a->quitcode=0; a->used=1; a->res=0; a->res_n=0;
    g_curApp=slot;
    /* модуль уже загружен JS loadDynamicLibrary -> dlopen вернёт его handle (синхронно);
       резолвим WinMain ИЗ ЭТОГО модуля (не RTLD_DEFAULT — иначе коллизия одноимённых WinMain). */
    void *hmod = dlopen(path, RTLD_NOW|RTLD_GLOBAL);
    int (*wm)(HINSTANCE,HINSTANCE,LPSTR,int) =
        (int(*)(HINSTANCE,HINSTANCE,LPSTR,int))(hmod ? dlsym(hmod, "WinMain") : 0);
    if(!wm){ a->used=0; return -1; }
    /* ресурсы (.ico/.bmp из .rc) этого модуля — через его экспортированные аксессоры */
    if(hmod){
        const WinwebRes* (*rtab)(void) = (const WinwebRes*(*)(void))dlsym(hmod, "winweb_res_table");
        int (*rn)(void) = (int(*)(void))dlsym(hmod, "winweb_res_n");
        if(rtab && rn){ a->res = rtab(); a->res_n = rn(); }
    }
    int rc = wm((HINSTANCE)1,(HINSTANCE)0,"",SW_SHOWNORMAL);
    a->used=0;     /* приложение вышло -> слот свободен */
    /* освобождаем классы этого приложения (иначе g_cls утечёт к лимиту 16 за сессию) */
    { int n=0; for(int i=0;i<g_ncls;i++) if(g_cls[i].app!=slot) g_cls[n++]=g_cls[i]; g_ncls=n; }
    return rc;
}
int main(void){ return 0; }   /* рантайм резидентен; приложение запускается позже */
#else
extern int WINAPI WinMain(HINSTANCE,HINSTANCE,LPSTR,int);
int main(void){ return WinMain((HINSTANCE)1,(HINSTANCE)0,"",SW_SHOWNORMAL); }
#endif
