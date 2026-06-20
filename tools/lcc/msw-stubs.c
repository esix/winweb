/* msw-stubs.c — заглушки для функций, которые ядро сапёра (game/graphics/utilities)
 * вызывает, но которые живут в sound.c/preferences.c/minesweeper.c (их в амальгаму не берём).
 * В браузере звук/реестр не нужны -> noop; конфиг -> дефолты Beginner.
 * Плюс libc-примитивы хоста (__read/__write/__exit) — сапёр не использует stdio, так что
 * безопасные заглушки закрывают и их (libc.c объявляет их extern -> здесь определяем).
 *
 * Файл амальгамируется ПОСЛЕДНИМ: все типы (INT/VOID/PREF/TCHAR/FAR) и g_GameConfig
 * уже объявлены выше по TU, поэтому #include не нужны и extern для g_GameConfig не нужен. */

/* --- libc host primitives (закрываем __read/__write/__exit) --- */
long __read(int fd, void *buf, unsigned long n) { (void)fd; (void)buf; (void)n; return 0; }
long __write(int fd, const void *buf, unsigned long n) { (void)fd; (void)buf; return (long)n; }
void __exit(int code) { (void)code; }

/* --- sound.c --- */
INT  InitializeAudioSystem(VOID) { return 0; }
VOID ShutdownAudioSystem(VOID) { }

/* --- preferences.c (config = Beginner defaults) --- */
INT  ReadRegistryInteger(INT iszPref, INT valDefault, INT valMin, INT valMax) { (void)iszPref; (void)valMin; (void)valMax; return valDefault; }
VOID ReadRegistryString(INT iszPref, TCHAR FAR *szRet) { (void)iszPref; szRet[0] = 0; }
VOID SaveConfiguration(VOID) { }
VOID LoadConfiguration(VOID) {
    g_GameConfig.wGameType = 0;   /* Beginner */
    g_GameConfig.Mines  = 10;
    g_GameConfig.Height = 9;
    g_GameConfig.Width  = 9;
    g_GameConfig.fSound = 0;
    g_GameConfig.fMark  = 1;
    g_GameConfig.fMenu  = 0;
    g_GameConfig.rgTime[0] = 999;
    g_GameConfig.rgTime[1] = 999;
    g_GameConfig.rgTime[2] = 999;
}

/* --- minesweeper.c (full-app helpers unused by the 3-core build) --- */
VOID CalcFrameRect(VOID) { }
VOID StopGame(VOID) { }
