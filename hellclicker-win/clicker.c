#include <windows.h>
#include <stdio.h>

#define WIN_W 640
#define WIN_H 480
#define TIMER_ID 42
#define AUTO_MS 200
#define AUTO_GAIN 0.5

static HWND g_hwnd;
static HFONT g_font;
static HFONT g_fontBig;
static double g_score;
static int g_taps;
static int g_auto;

static const wchar_t* CLS_NAME = L"TinyHell";

LRESULT CALLBACK WndProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam);

static void DrawTxt(HDC mem, HFONT f, int x, int y, int w, int h, const wchar_t* text) {
    RECT r;
    r.left = x; r.top = y; r.right = x + w; r.bottom = y + h;
    DrawTextW(mem, text, -1, &r, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
}

static void PaintWindow(HWND hwnd) {
    PAINTSTRUCT ps;
    HDC hdc = BeginPaint(hwnd, &ps);
    HDC mem = CreateCompatibleDC(ps.hdc);
    HBITMAP bm = CreateCompatibleBitmap(ps.hdc, WIN_W, WIN_H);
    SelectObject(mem, bm);
    HBRUSH br = CreateSolidBrush(RGB(247, 247, 247));
    SelectObject(mem, br);
    PatBlt(mem, 0, 0, WIN_W, WIN_H, WHITENESS);
    SelectObject(mem, g_font);
    SetBkMode(mem, TRANSPARENT);
    SetTextColor(mem, RGB(170, 20, 20));
    wchar_t buf[128];
    swprintf(buf, 128, L"SCORE: %.1f", g_score);
    DrawTxt(mem, g_font, 0, 120, WIN_W, 50, buf);
    swprintf(buf, 128, L"SLAY! x%d", g_taps);
    DrawTxt(mem, g_fontBig, WIN_W / 2, WIN_H / 2 - 40, WIN_W, 90, buf);
    swprintf(buf, 128, L"AUTO: %s (x%.1f)", g_auto ? L"ON" : L"OFF", g_auto ? AUTO_GAIN : 0.0);
    DrawTxt(mem, g_font, 0, WIN_H - 60, WIN_W, 40, buf);
    swprintf(buf, 128, L"KEY A: AUTO | KEY R: RESET");
    DrawTxt(mem, g_font, 0, WIN_H - 30, WIN_W, 25, buf);
    BitBlt(ps.hdc, 0, 0, WIN_W, WIN_H, mem, 0, 0, SRCCOPY);
    DeleteObject(bm);
    DeleteDC(mem);
    DeleteObject(br);
    EndPaint(hwnd, &ps);
}

int WINAPI WinMain(HINSTANCE hInst, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    WNDCLASSEXW wc;
    memset(&wc, 0, sizeof(wc));
    wc.cbSize = sizeof(WNDCLASSEXW);
    wc.style = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc = WndProc;
    wc.cbClsExtra = 0;
    wc.cbWndExtra = 0;
    wc.hInstance = hInst;
    wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
    wc.lpszClassName = CLS_NAME;
    RegisterClassExW(&wc);
    g_hwnd = CreateWindowExW(0, CLS_NAME, L"HELLCLICKER.EXE", WS_OVERLAPPEDWINDOW, CW_USEDEFAULT, CW_USEDEFAULT, WIN_W, WIN_H, NULL, NULL, hInst, NULL);
    ShowWindow(g_hwnd, nCmdShow);
    UpdateWindow(g_hwnd);
    MSG msg;
    while (GetMessageW(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    return (int)msg.wParam;
}

LRESULT CALLBACK WndProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
    switch (uMsg) {
    case WM_CREATE: {
        g_font = CreateFontW(20, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, OUT_DEFAULT_PRECIS, DEFAULT_QUALITY, 0, L"Arial");
        g_fontBig = CreateFontW(52, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, OUT_DEFAULT_PRECIS, DEFAULT_QUALITY, 0, L"Arial");
        SetTimer(hwnd, TIMER_ID, g_auto ? AUTO_MS : 0, NULL);
        return 0;
    }
    case WM_TIMER:
        if (g_auto) { g_score += AUTO_GAIN; InvalidateRect(hwnd, NULL, FALSE); }
        return 0;
    case WM_LBUTTONDOWN: {
        int y = HIWORD(lParam);
        if (y > WIN_H - 100) {
            g_auto = !g_auto;
            SetTimer(hwnd, TIMER_ID, g_auto ? AUTO_MS : 0, NULL);
            InvalidateRect(hwnd, NULL, FALSE);
            return 0;
        }
        g_score += 1.0;
        g_taps++;
        InvalidateRect(hwnd, NULL, FALSE);
        return 0;
    }
    case WM_KEYDOWN:
        if (wParam == 'A') { g_auto = !g_auto; SetTimer(hwnd, TIMER_ID, g_auto ? AUTO_MS : 0, NULL); InvalidateRect(hwnd, NULL, FALSE); return 0; }
        if (wParam == 'R') { g_score = 0.0; InvalidateRect(hwnd, NULL, FALSE); return 0; }
        return 0;
    case WM_PAINT:
        PaintWindow(hwnd);
        return 0;
    case WM_DESTROY:
        KillTimer(hwnd, TIMER_ID);
        PostQuitMessage(0);
        return 0;
    default:
        return DefWindowProcW(hwnd, uMsg, wParam, lParam);
    }
}
