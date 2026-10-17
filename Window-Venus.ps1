if (-not ('VenusDesktopWindow' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
public static class VenusDesktopWindow {
    private delegate bool EnumCallback(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumCallback callback, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetWindowText(IntPtr window, StringBuilder text, int length);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
    public static IntPtr[] Windows() {
        var matches = new List<IntPtr>();
        EnumWindows((window, parameter) => {
            if (!IsWindowVisible(window)) return true;
            var text = new StringBuilder(512);
            GetWindowText(window, text, text.Capacity);
            if (text.ToString() != "Venus / \u542f\u660e\u661f") return true;
            uint process; GetWindowThreadProcessId(window, out process);
            try { if (Process.GetProcessById((int)process).ProcessName == "msedge") matches.Add(window); }
            catch (ArgumentException) { }
            return true;
        }, IntPtr.Zero);
        return matches.ToArray();
    }
    public static bool Reuse() {
        var windows = Windows();
        if (windows.Length == 0) return false;
        var keep = windows[0];
        var foreground = GetForegroundWindow();
        foreach (var window in windows) if (window == foreground) keep = window;
        foreach (var window in windows) if (window != keep) PostMessage(window, 0x0010, IntPtr.Zero, IntPtr.Zero);
        ShowWindow(keep, 9);
        SetForegroundWindow(keep);
        return true;
    }
}
'@
}
