using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;

namespace Arest.Wpf
{
    /// <summary>What lambda answers for one navigation, read positionally as ui:frame_out built it.</summary>
    public sealed class Frame
    {
        public object Stacks = new object[0];
        public object[] Style = new object[0];
        public readonly List<KeyValuePair<string, object[]>> Panes = new List<KeyValuePair<string, object[]>>();
        public readonly List<string> Unpaired = new List<string>();
        public object[] Alert;
        public int Status;

        public static Frame From(object answer, int status)
        {
            var a = answer as object[] ?? new object[0];
            var f = new Frame { Status = status };
            if (a.Length > 0) f.Stacks = a[0];
            if (a.Length > 1 && a[1] is object[] style) f.Style = style;
            if (a.Length > 2 && a[2] is object[] panes)
                foreach (var e in panes.OfType<object[]>().Where(e => e.Length >= 2))
                    f.Panes.Add(new KeyValuePair<string, object[]>(Rows.Text(e[0]), e[1] as object[] ?? new object[0]));
            if (a.Length > 3 && a[3] is object[] unpaired) f.Unpaired.AddRange(unpaired.Select(Rows.Text));
            f.Alert = a.Length > 4 && Rows.NonEmpty(a[4]) ? (object[])a[4] : null;
            return f;
        }
    }

    /// <summary>
    /// One platform: what it registered, its stacks (its form factor), its pane widths, and the
    /// last frame lambda answered, a pane the answer leaves out keeping what it showed. Sam,
    /// 2026-09-20: a UI is a platform registration, a shim that hands the platform's events to
    /// canon and renders what canon answers. MonoCross names the event (MXContainer.Navigate) and
    /// lambda serves it as navigate, so the serving host's POST /navigate is the whole protocol:
    /// the request is stacks, address, widths, registered, defaults, from; the answer is stacks,
    /// style, panes, unpaired, alert. A write is a request of the same interface (main:api through
    /// navigate), so this validates nothing and persists nothing.
    /// </summary>
    public sealed class Platform
    {
        public const int MasterWidth = 320;
        public const int SplitMinWidth = 900;
        static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromMinutes(2) };

        public readonly string[] PaneNames;
        public readonly int Width;
        public readonly List<string> Registered;
        public object Stacks;
        public readonly List<KeyValuePair<string, object[]>> Placed = new List<KeyValuePair<string, object[]>>();
        public object[] Alert;
        public List<string> Unpaired = new List<string>();
        public int Status;

        public Platform(int width, List<string> registered)
        {
            Width = width;
            PaneNames = width >= SplitMinWidth ? new[] { "master", "detail" } : new[] { "master" };
            Registered = registered;
            Stacks = PaneNames.Select(p => (object)new object[] { p, new object[0] }).ToArray();
        }

        public int PaneWidth(int i)
        {
            if (PaneNames.Length <= 1) return Width;
            var rest = Math.Max(Width - MasterWidth * (PaneNames.Length - 1), MasterWidth);
            return i < PaneNames.Length - 1 ? MasterWidth : rest;
        }

        public static string ServeBase()
        {
            var url = Environment.GetEnvironmentVariable("AREST_SERVE");
            if (!string.IsNullOrEmpty(url)) return url;
            var port = Environment.GetEnvironmentVariable("AREST_PORT");
            return "http://127.0.0.1:" + (string.IsNullOrEmpty(port) ? "8787" : port);
        }

        /// <summary>
        /// Hand one navigation to lambda. A refused write answers its frame with the refusal as its
        /// alert; any other non-2xx answer, or a transport failure, is an error, never an empty frame.
        /// A frame naming an unpaired kind moves nothing: it is a refusal to draw.
        /// </summary>
        public Frame Go(object address, string from)
        {
            var widths = PaneNames.Select((p, i) => (object)new object[] { p, PaneWidth(i) }).ToArray();
            var body = new object[] { Stacks, address, widths, Registered.ToArray(), Registry.PlatformDefaults(),
                                      from == null ? (object)new object[0] : from };
            var request = new StringContent(Json.Write(body), Encoding.UTF8, "application/json");
            using var response = Http.PostAsync(ServeBase() + "/navigate", request).GetAwaiter().GetResult();
            var status = (int)response.StatusCode;
            var text = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            object answer;
            try { answer = Json.Parse(text); } catch (JsonException) { answer = null; }
            if (status >= 400 && !(answer is object[] a5 && a5.Length == 5))
                throw new InvalidOperationException("navigate answered " + status + ": " + text.Substring(0, Math.Min(200, text.Length)));
            var f = Frame.From(answer, status);
            Unpaired = f.Unpaired;
            Status = f.Status;
            if (f.Unpaired.Count > 0) return f;
            Stacks = f.Stacks;
            foreach (var pane in f.Panes)
            {
                var at = Placed.FindIndex(p => p.Key == pane.Key);
                if (at >= 0) Placed[at] = pane; else Placed.Add(pane);
            }
            Alert = f.Alert;
            return f;
        }
    }

    /// <summary>The request's and the answer's encoding: arrays, strings and numbers.</summary>
    public static class Json
    {
        public static object Parse(string text)
        {
            using var doc = JsonDocument.Parse(text);
            return From(doc.RootElement);
        }

        static object From(JsonElement e) => e.ValueKind switch
        {
            JsonValueKind.Array => e.EnumerateArray().Select(From).ToArray(),
            JsonValueKind.String => e.GetString(),
            JsonValueKind.Number => e.TryGetInt32(out var i) ? i : e.TryGetInt64(out var l) ? l : (object)e.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Object => e.EnumerateObject().ToDictionary(p => p.Name, p => From(p.Value)),
            _ => null,
        };

        public static string Write(object value) => JsonSerializer.Serialize<object>(value);
    }
}
