using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;

// 설치 파일이 새 버전을 적용하는 동안만 표시하는 별도 창. 기록·네트워크·설치 파일에는 접근하지 않는다.
internal sealed class ProgressWindow : Form {
    private readonly Process parent;
    private readonly Timer timer = new Timer();
    private readonly string version;
    private readonly float scale;
    private readonly Image icon;
    private double phase;
    private readonly bool animate;
    private readonly Color canvas = Color.FromArgb(255, 250, 251);
    private readonly Color ink = Color.FromArgb(62, 52, 56);
    private readonly Color muted = Color.FromArgb(133, 119, 125);
    private readonly Color accent = Color.FromArgb(207, 143, 168);
    [DllImport("user32.dll")] private static extern bool SetProcessDPIAware();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern bool SystemParametersInfo(uint action, uint parameter, out bool value, uint flags);
    [DllImport("user32.dll")] private static extern bool ReleaseCapture();
    [DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr window, int message, IntPtr wparam, IntPtr lparam);
    [DllImport("dwmapi.dll")] private static extern int DwmSetWindowAttribute(IntPtr window, int attribute, ref int value, int size);

    private ProgressWindow(Process owner, string release) {
        parent = owner; version = release;
        bool enabled; animate = !SystemParametersInfo(0x1042, 0, out enabled, 0) || enabled;
        using (Graphics screen = Graphics.FromHwnd(IntPtr.Zero)) scale = screen.DpiX / 96f;
        var area = Screen.FromPoint(Cursor.Position).WorkingArea;
        scale = Math.Min(scale, Math.Min((area.Width - 32) / 420f, (area.Height - 32) / 244f));
        Text = "미니어리 업데이트 중";
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.CenterScreen;
        AutoScaleMode = AutoScaleMode.None;
        ClientSize = new Size((int)(420 * scale), (int)(244 * scale));
        BackColor = canvas; DoubleBuffered = true; ShowInTaskbar = false; TopMost = true;
        using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("MiniallyIcon"))
        using (var source = Image.FromStream(stream)) icon = new Bitmap(source);
        using (var shape = Rounded(0, 0, ClientSize.Width, ClientSize.Height, 24 * scale)) Region = new Region(shape);
        MouseDown += delegate(object sender, MouseEventArgs e) {
            if (e.Button == MouseButtons.Left) { ReleaseCapture(); SendMessage(Handle, 0xA1, new IntPtr(2), IntPtr.Zero); }
        };
        timer.Interval = 32;
        timer.Tick += delegate {
            try { if (parent.HasExited) { Close(); return; } } catch { Close(); return; }
            if (animate) phase = (phase + .012) % 1;
            Invalidate();
        };
        Shown += delegate { int rounded = 2; try { DwmSetWindowAttribute(Handle, 33, ref rounded, 4); } catch { } timer.Start(); };
    }
    protected override CreateParams CreateParams { get { var value = base.CreateParams; value.ClassStyle |= 0x20000; return value; } }
    private static GraphicsPath Rounded(float x, float y, float width, float height, float radius) {
        var path = new GraphicsPath(); float d = radius * 2;
        path.AddArc(x, y, d, d, 180, 90); path.AddArc(x + width - d, y, d, d, 270, 90);
        path.AddArc(x + width - d, y + height - d, d, d, 0, 90); path.AddArc(x, y + height - d, d, d, 90, 90); path.CloseFigure(); return path;
    }
    private void TextAt(Graphics g, string text, float size, FontStyle style, Color color, RectangleF box) {
        using (var font = new Font("맑은 고딕", size, style, GraphicsUnit.Pixel))
        using (var brush = new SolidBrush(color)) g.DrawString(text, font, brush, box);
    }
    protected override void OnPaint(PaintEventArgs e) {
        base.OnPaint(e); Graphics g = e.Graphics; g.ScaleTransform(scale, scale); g.SmoothingMode = SmoothingMode.AntiAlias; g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
        using (var border = new Pen(Color.FromArgb(240, 231, 235)))
        using (var shape = Rounded(.5f, .5f, 419, 243, 23)) g.DrawPath(border, shape);
        g.DrawImage(icon, new RectangleF(32, 28, 34, 34));
        TextAt(g, "미니어리", 14, FontStyle.Bold, ink, new RectangleF(77, 35, 170, 26));
        using (var fill = new SolidBrush(Color.FromArgb(246, 232, 237)))
        using (var pill = Rounded(310, 32, 78, 25, 12)) g.FillPath(fill, pill);
        TextAt(g, "V." + version, 11, FontStyle.Regular, muted, new RectangleF(319, 36, 70, 20));
        TextAt(g, "업데이트하고 있어요", 21, FontStyle.Bold, ink, new RectangleF(30, 83, 360, 34));
        TextAt(g, "새 버전을 적용하고 있습니다.\n기록은 그대로 유지돼요.", 13, FontStyle.Regular, muted, new RectangleF(31, 122, 360, 45));
        using (var track = Rounded(32, 183, 356, 6, 3)) {
            using (var fill = new SolidBrush(Color.FromArgb(246, 232, 237))) g.FillPath(fill, track);
            var saved = g.Save(); g.SetClip(track);
            float left = 32 + (356 - 88) * (float)(.5 - .5 * Math.Cos(phase * Math.PI * 2));
            using (var segment = Rounded(left, 183, 88, 6, 3))
            using (var fill = new SolidBrush(accent)) g.FillPath(fill, segment);
            g.Restore(saved);
        }
        TextAt(g, "완료되면 앱이 자동으로 다시 열립니다.", 11, FontStyle.Regular, muted, new RectangleF(31, 205, 360, 20));
    }
    protected override void Dispose(bool disposing) {
        if (disposing) { timer.Dispose(); icon.Dispose(); parent.Dispose(); }
        base.Dispose(disposing);
    }
    [STAThread] private static void Main(string[] args) {
        int id;
        if (args.Length != 2 || !int.TryParse(args[0], out id) || id <= 0 || !System.Text.RegularExpressions.Regex.IsMatch(args[1], @"^\d+\.\d+\.\d+$")) return;
        try {
            SetProcessDPIAware(); Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
            var owner = Process.GetProcessById(id); if (owner.HasExited) { owner.Dispose(); return; }
            Application.Run(new ProgressWindow(owner, args[1]));
        } catch { /* 진행 창 오류가 실제 업데이트를 중단하지 않게 한다. */ }
    }
}
