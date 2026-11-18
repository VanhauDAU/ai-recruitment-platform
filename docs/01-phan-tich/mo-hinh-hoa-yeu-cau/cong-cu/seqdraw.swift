// seqdraw: bộ vẽ sơ đồ tuần tự UML (PNG nền trắng, nét đen).
// Biên dịch: swiftc -O seqdraw.swift -o seqdraw
// Dùng:      ./seqdraw input.seq output.png
// Cú pháp tệp .seq:
//   title Tiêu đề
//   actor|participant|database|queue|external ID Nhãn (\n để xuống dòng)
//   A -> B : thông điệp     (gọi đồng bộ, đầu mũi tên đặc)
//   A ->> B : thông điệp    (thông điệp bất đồng bộ, đầu mũi tên mở)
//   A --> B : thông điệp    (thông điệp trả về, nét đứt)
//   group|alt|opt|loop|par|break|critical Nhãn ... else Nhãn ... end
//   note over A[,B] : ghi chú | note right of A : ghi chú | note left of A : ghi chú
import AppKit

let fontName = "Arial", boldName = "Arial-BoldMT"
let msgFont = NSFont(name: fontName, size: 13)!
let smallBold = NSFont(name: boldName, size: 12)!
let small = NSFont(name: fontName, size: 12)!
let headFont = NSFont(name: fontName, size: 13.5)!
let titleFont = NSFont(name: boldName, size: 16)!

func lines(_ s: String) -> [String] { s.replacingOccurrences(of: "\\n", with: "\n").components(separatedBy: "\n") }
func tsize(_ s: String, _ f: NSFont) -> CGSize {
    var w: CGFloat = 0; let ls = lines(s)
    for l in ls { w = max(w, (l as NSString).size(withAttributes: [.font: f]).width) }
    return CGSize(width: ceil(w), height: CGFloat(ls.count) * (f.pointSize + 3.5))
}
func wrap(_ s: String, _ f: NSFont, _ maxW: CGFloat) -> String {
    var out: [String] = []
    for para in lines(s) {
        var cur = ""
        for w in para.split(separator: " ").map(String.init) {
            let cand = cur.isEmpty ? w : cur + " " + w
            if !cur.isEmpty && (cand as NSString).size(withAttributes: [.font: f]).width > maxW { out.append(cur); cur = w } else { cur = cand }
        }
        out.append(cur)
    }
    return out.joined(separator: "\\n")
}
let maxMsgW: CGFloat = 215, maxNoteW: CGFloat = 330

enum PKind { case actor, box, database, queue, external }
struct Part { var id: String; var label: String; var kind: PKind; var w: CGFloat = 0; var x: CGFloat = 0 }
enum Arrow { case sync, async, ret }
indirect enum El {
    case msg(from: Int, to: Int, text: String, arrow: Arrow)
    case frag(kind: String, label: String, sections: [(String, [El])])
    case note(parts: [Int], side: String, text: String)
}

// ---------- đọc tệp ----------
let args = CommandLine.arguments
let src = try! String(contentsOfFile: args[1], encoding: .utf8)
var title = ""
var parts: [Part] = []
func pidx(_ id: String) -> Int {
    if let i = parts.firstIndex(where: { $0.id == id }) { return i }
    fatalError("unknown participant \(id) in \(args[1])")
}
var stack: [(kind: String, label: String, sections: [(String, [El])])] = []
var root: [El] = []
func append(_ e: El) {
    if stack.isEmpty { root.append(e) } else { stack[stack.count - 1].sections[stack[stack.count - 1].sections.count - 1].1.append(e) }
}
for raw in src.components(separatedBy: "\n") {
    let line = raw.trimmingCharacters(in: .whitespaces)
    if line.isEmpty || line.hasPrefix("#") { continue }
    let first = line.split(separator: " ", maxSplits: 1).map(String.init)
    let kw = first[0], rest = first.count > 1 ? first[1] : ""
    switch kw {
    case "title": title = rest
    case "actor", "participant", "database", "queue", "external":
        let p = rest.split(separator: " ", maxSplits: 1).map(String.init)
        let k: PKind = kw == "actor" ? .actor : kw == "database" ? .database : kw == "queue" ? .queue : kw == "external" ? .external : .box
        parts.append(Part(id: p[0], label: p.count > 1 ? p[1] : p[0], kind: k))
    case "group", "alt", "opt", "loop", "par", "break", "critical":
        stack.append((kw, rest, [(rest, [])]))
    case "else":
        stack[stack.count - 1].sections.append((rest, []))
    case "end":
        let f = stack.removeLast()
        append(.frag(kind: f.kind, label: f.label, sections: f.sections))
    case "note":
        let segs = rest.components(separatedBy: " : ")
        let head = segs[0].split(separator: " ").map(String.init)
        let text = wrap(segs.dropFirst().joined(separator: " : "), small, maxNoteW)
        if head[0] == "over" {
            append(.note(parts: head[1].split(separator: ",").map { pidx(String($0)) }, side: "over", text: text))
        } else {
            append(.note(parts: [pidx(head[2])], side: head[0], text: text))
        }
    default:
        let segs = line.components(separatedBy: " : ")
        let lhs = segs[0], text = segs.dropFirst().joined(separator: " : ")
        var arrow: Arrow = .sync; var sep = "->"
        if lhs.contains("-->") { arrow = .ret; sep = "-->" } else if lhs.contains("->>") { arrow = .async; sep = "->>" }
        let ab = lhs.components(separatedBy: sep).map { $0.trimmingCharacters(in: .whitespaces) }
        append(.msg(from: pidx(ab[0]), to: pidx(ab[1]), text: wrap(text, msgFont, maxMsgW), arrow: arrow))
    }
}
if !stack.isEmpty { fatalError("unclosed fragment in \(args[1])") }

// ---------- đánh số thông điệp ----------
var counter = 0
func number(_ es: [El]) -> [El] {
    es.map { e in
        switch e {
        case let .msg(f, t, text, a): counter += 1; return .msg(from: f, to: t, text: "\(counter). " + text, arrow: a)
        case let .frag(k, l, secs): return .frag(kind: k, label: l, sections: secs.map { ($0.0, number($0.1)) })
        default: return e
        }
    }
}
root = number(root)

// ---------- bố cục ngang ----------
let n = parts.count
for i in 0..<n {
    let s = tsize(parts[i].label, headFont)
    parts[i].w = parts[i].kind == .actor ? max(s.width, 40) : max(s.width + 24, 70)
}
var gap = [CGFloat](repeating: 0, count: max(n - 1, 0))
for i in 0..<max(n - 1, 0) { gap[i] = max(parts[i].w / 2 + parts[i + 1].w / 2 + 28, 105) }
var rightNeed: CGFloat = 0
var leftNeed: CGFloat = 0
func need(_ l: Int, _ r: Int, _ width: CGFloat) {
    if l == r { return }
    let have = (l..<r).reduce(CGFloat(0)) { $0 + gap[$1] }
    if have < width { let add = (width - have) / CGFloat(r - l); for k in l..<r { gap[k] += add } }
}
func involved(_ es: [El]) -> Set<Int> {
    var s = Set<Int>()
    for e in es {
        switch e {
        case let .msg(f, t, _, _): s.insert(f); s.insert(t)
        case let .frag(_, _, secs): for sec in secs { s.formUnion(involved(sec.1)) }
        case let .note(ps, side, _): s.formUnion(ps); if side == "right", ps[0] + 1 < n { s.insert(ps[0] + 1) }
        }
    }
    return s
}
func depth(_ es: [El]) -> Int {
    var d = 0
    for e in es { if case let .frag(_, _, secs) = e { d = max(d, 1 + secs.map { depth($0.1) }.max()!) } }
    return d
}
let fragPad: CGFloat = 10, fragStep: CGFloat = 9
func constrain(_ es: [El]) {
    for e in es {
        switch e {
        case let .msg(f, t, text, _):
            let w = tsize(text, msgFont).width
            if f == t {
                if f < n - 1 { need(f, f + 1, w + 46) } else { rightNeed = max(rightNeed, w + 46) }
            } else { need(min(f, t), max(f, t), w + 26) }
        case let .note(ps, side, text):
            let w = tsize(text, small).width + 22
            if side == "over" {
                let l = ps.min()!, r = ps.max()!
                if l == r {
                    if l > 0 { need(l - 1, l, w / 2 + parts[l - 1].w / 2 + 10) } else { leftNeed = max(leftNeed, w / 2) }
                    if l < n - 1 { need(l, l + 1, w / 2 + parts[l + 1].w / 2 + 10) } else { rightNeed = max(rightNeed, w / 2) }
                } else { need(l, r, w - 30) }
            } else if side == "right" {
                let p = ps[0]; if p < n - 1 { need(p, p + 1, w + 20) } else { rightNeed = max(rightNeed, w + 20) }
            } else {
                let p = ps[0]; if p > 0 { need(p - 1, p, w + 20) } else { leftNeed = max(leftNeed, w + 20) }
            }
        case let .frag(kind, label, secs):
            for sec in secs { constrain(sec.1) }
            let inv = involved(secs.flatMap { $0.1 })
            guard let l = inv.min(), let r = inv.max() else { break }
            let m = fragPad + fragStep * CGFloat(depth(secs.flatMap { $0.1 }))
            var w = tsize(kind == "group" ? label : kind, smallBold).width + 30
            if kind != "group" { w += tsize("[\(label)]", smallBold).width + 12 }
            for sec in secs.dropFirst() { w = max(w, tsize("[\(sec.0)]", smallBold).width + 30) }
            if l == r { rightNeed = max(rightNeed, w - m) } else { need(l, r, w - 2 * m) }
        }
    }
}
for _ in 0..<3 { constrain(root) }
let maxM = fragPad + fragStep * CGFloat(depth(root))
var x = 30 + max(parts[0].w / 2, maxM + 4, leftNeed)
for i in 0..<n { parts[i].x = x; if i < n - 1 { x += gap[i] } }
let titleW = tsize(title, titleFont).width
let width = max(x + max(parts[n - 1].w / 2, maxM + 4, rightNeed) + 30, titleW + 60)

// ---------- bố cục dọc ----------
enum Cmd {
    case arrow(x1: CGFloat, x2: CGFloat, y: CGFloat, text: String, a: Arrow)
    case selfMsg(x: CGFloat, y: CGFloat, text: String, a: Arrow)
    case frame(x1: CGFloat, x2: CGFloat, y1: CGFloat, y2: CGFloat, kind: String, label: String, elses: [(CGFloat, String)])
    case note(x1: CGFloat, x2: CGFloat, y: CGFloat, h: CGFloat, text: String)
}
var cmds: [Cmd] = []
var ext: [(CGFloat, CGFloat)] = []
let headTop: CGFloat = title.isEmpty ? 20 : 54
func headH(_ p: Part) -> CGFloat { p.kind == .actor ? 48 + tsize(p.label, headFont).height : tsize(p.label, headFont).height + 16 + (p.kind == .database ? 12 : 0) }
let headMax = parts.map(headH).max()!
var y = headTop + headMax + 18

func layout(_ es: [El]) {
    for e in es {
        switch e {
        case let .msg(f, t, text, a):
            let th = tsize(text, msgFont).height
            y += th + 2
            if f == t {
                cmds.append(.selfMsg(x: parts[f].x, y: y, text: text, a: a))
                let right = parts[f].x + max(tsize(text, msgFont).width + 16, 44)
                for k in 0..<ext.count { ext[k].1 = max(ext[k].1, right + fragStep * CGFloat(ext.count - 1 - k)) }
                y += 24
            }
            else { cmds.append(.arrow(x1: parts[f].x, x2: parts[t].x, y: y, text: text, a: a)); y += 12 }
        case let .note(ps, side, text):
            let s = tsize(text, small); let w = s.width + 22, h = s.height + 10
            var x1: CGFloat, x2: CGFloat
            let l = ps.min()!, r = ps.max()!
            if side == "over" {
                if l == r { x1 = parts[l].x - w / 2; x2 = parts[l].x + w / 2 }
                else { x1 = min(parts[l].x - 20, (parts[l].x + parts[r].x - w) / 2); x2 = max(parts[r].x + 20, x1 + w) }
            } else if side == "right" { x1 = parts[l].x + 12; x2 = x1 + w } else { x2 = parts[l].x - 12; x1 = x2 - w }
            y += 4
            cmds.append(.note(x1: x1, x2: x2, y: y, h: h, text: text))
            for k in 0..<ext.count { ext[k] = (min(ext[k].0, x1 - 8), max(ext[k].1, x2 + 8)) }
            y += h + 10
        case let .frag(kind, label, secs):
            let inv = involved(secs.flatMap { $0.1 })
            let l = inv.min() ?? 0, r = inv.max() ?? 0
            let m = fragPad + fragStep * CGFloat(depth(secs.flatMap { $0.1 }))
            var x2 = parts[r].x + m
            if l == r { x2 = max(x2, parts[r].x + rightNeed) }
            let y1 = y + 4
            y = y1 + 24
            var elses: [(CGFloat, String)] = []
            ext.append((parts[l].x - m, x2))
            for (i, sec) in secs.enumerated() {
                if i > 0 { y += 4; elses.append((y, sec.0)); y += 20 }
                layout(sec.1)
            }
            let (ex1, ex2) = ext.removeLast()
            for k in 0..<ext.count { ext[k] = (min(ext[k].0, ex1 - fragStep), max(ext[k].1, ex2 + fragStep)) }
            y += 8
            cmds.append(.frame(x1: max(ex1, 6), x2: min(ex2, width - 8), y1: y1, y2: y, kind: kind, label: label, elses: elses))
            y += 6
        }
    }
}
layout(root)
y += 16
let footTop = y
let height = footTop + headMax + 20

// ---------- vẽ ----------
let scale: CGFloat = 2.2
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(width * scale), pixelsHigh: Int(height * scale),
                           bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                           colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
let cg = NSGraphicsContext(bitmapImageRep: rep)!.cgContext
cg.translateBy(x: 0, y: height * scale); cg.scaleBy(x: scale, y: -scale)
NSGraphicsContext.current = NSGraphicsContext(cgContext: cg, flipped: true)
cg.setFillColor(NSColor.white.cgColor); cg.fill(CGRect(x: 0, y: 0, width: width, height: height))
let black = NSColor.black
cg.setStrokeColor(black.cgColor); cg.setFillColor(black.cgColor)

func text(_ s: String, _ x: CGFloat, _ y: CGFloat, _ f: NSFont, center: Bool = false) {
    var yy = y
    for l in lines(s) {
        let w = (l as NSString).size(withAttributes: [.font: f]).width
        (l as NSString).draw(at: CGPoint(x: center ? x - w / 2 : x, y: yy), withAttributes: [.font: f, .foregroundColor: black])
        yy += f.pointSize + 3.5
    }
}
func line(_ a: CGPoint, _ b: CGPoint, w: CGFloat = 1, dash: [CGFloat] = []) {
    cg.setLineWidth(w); cg.setLineDash(phase: 0, lengths: dash)
    cg.move(to: a); cg.addLine(to: b); cg.strokePath(); cg.setLineDash(phase: 0, lengths: [])
}
func rect(_ r: CGRect, w: CGFloat = 1.2, fill: Bool = true) {
    if fill { cg.setFillColor(NSColor.white.cgColor); cg.fill(r); cg.setFillColor(black.cgColor) }
    cg.setLineWidth(w); cg.stroke(r)
}
func head(_ x: CGFloat, _ y: CGFloat, dir: CGFloat, open: Bool) {
    let p1 = CGPoint(x: x - dir * 10, y: y - 5), p2 = CGPoint(x: x - dir * 10, y: y + 5)
    if open { line(p1, CGPoint(x: x, y: y), w: 1.1); line(p2, CGPoint(x: x, y: y), w: 1.1) }
    else { cg.move(to: CGPoint(x: x, y: y)); cg.addLine(to: p1); cg.addLine(to: p2); cg.closePath(); cg.fillPath() }
}
func drawHead(_ p: Part, top: CGFloat) {
    let s = tsize(p.label, headFont)
    switch p.kind {
    case .actor:
        let cx = p.x, t = top + headMax - headH(p)
        cg.setLineWidth(1.3); cg.setFillColor(NSColor.white.cgColor)
        let c = CGRect(x: cx - 7, y: t, width: 14, height: 14); cg.fillEllipse(in: c); cg.strokeEllipse(in: c); cg.setFillColor(black.cgColor)
        line(CGPoint(x: cx, y: t + 14), CGPoint(x: cx, y: t + 31), w: 1.3)
        line(CGPoint(x: cx - 12, y: t + 20), CGPoint(x: cx + 12, y: t + 20), w: 1.3)
        line(CGPoint(x: cx, y: t + 31), CGPoint(x: cx - 10, y: t + 43), w: 1.3)
        line(CGPoint(x: cx, y: t + 31), CGPoint(x: cx + 10, y: t + 43), w: 1.3)
        text(p.label, cx, t + 46, headFont, center: true)
    case .database:
        let h = s.height + 16, t = top + headMax - h - 12, r = CGRect(x: p.x - p.w / 2, y: t + 6, width: p.w, height: h + 6)
        cg.setFillColor(NSColor.white.cgColor); cg.fill(r); cg.setFillColor(black.cgColor)
        line(CGPoint(x: r.minX, y: r.minY), CGPoint(x: r.minX, y: r.maxY), w: 1.2)
        line(CGPoint(x: r.maxX, y: r.minY), CGPoint(x: r.maxX, y: r.maxY), w: 1.2)
        let e1 = CGRect(x: r.minX, y: r.minY - 6, width: p.w, height: 12)
        cg.setLineWidth(1.2)
        cg.setFillColor(NSColor.white.cgColor); cg.fillEllipse(in: e1); cg.setFillColor(black.cgColor); cg.strokeEllipse(in: e1)
        cg.saveGState(); cg.translateBy(x: p.x, y: r.maxY); cg.scaleBy(x: p.w / 2, y: 6)
        cg.addArc(center: .zero, radius: 1, startAngle: 0, endAngle: .pi, clockwise: false); cg.restoreGState(); cg.strokePath()
        text(p.label, p.x, t + 16, headFont, center: true)
    default:
        let h = s.height + 16, t = top + headMax - h
        let r = CGRect(x: p.x - p.w / 2, y: t, width: p.w, height: h)
        rect(r)
        if p.kind == .queue { line(CGPoint(x: r.minX + 6, y: r.minY), CGPoint(x: r.minX + 6, y: r.maxY)); line(CGPoint(x: r.maxX - 6, y: r.minY), CGPoint(x: r.maxX - 6, y: r.maxY)) }
        if p.kind == .external { rect(r.insetBy(dx: 3, dy: 3), w: 0.8, fill: false) }
        text(p.label, p.x, t + 8, headFont, center: true)
    }
}

if !title.isEmpty { text(title, width / 2, 18, titleFont, center: true) }
for p in parts { line(CGPoint(x: p.x, y: headTop + headMax), CGPoint(x: p.x, y: footTop), w: 0.9, dash: [5, 4]) }
for c in cmds {
    guard case let .frame(x1, x2, y1, y2, kind, label, elses) = c else { continue }
    cg.setLineWidth(1.4); cg.stroke(CGRect(x: x1, y: y1, width: x2 - x1, height: y2 - y1))
    let tag = kind == "group" ? label : kind
    let tw = tsize(tag, smallBold).width
    let px = x1 + tw + 18, ph: CGFloat = 19
    cg.setFillColor(NSColor.white.cgColor)
    cg.move(to: CGPoint(x: x1, y: y1)); cg.addLine(to: CGPoint(x: px, y: y1)); cg.addLine(to: CGPoint(x: px, y: y1 + ph - 6))
    cg.addLine(to: CGPoint(x: px - 6, y: y1 + ph)); cg.addLine(to: CGPoint(x: x1, y: y1 + ph)); cg.closePath()
    cg.drawPath(using: .fillStroke); cg.setFillColor(black.cgColor)
    text(tag, x1 + 7, y1 + 3, smallBold)
    if kind != "group" { text("[\(label)]", px + 8, y1 + 3, smallBold) }
    for (ey, el) in elses {
        line(CGPoint(x: x1, y: ey), CGPoint(x: x2, y: ey), w: 1, dash: [4, 3])
        text("[\(el)]", x1 + 7, ey + 3, smallBold)
    }
}
for c in cmds {
    switch c {
    case let .arrow(x1, x2, yy, s, a):
        let dir: CGFloat = x2 > x1 ? 1 : -1
        line(CGPoint(x: x1, y: yy), CGPoint(x: x2 - dir * (a == .sync ? 9 : 1), y: yy), w: 1.1, dash: a == .ret ? [6, 4] : [])
        head(x2, yy, dir: dir, open: a != .sync)
        let th = tsize(s, msgFont).height
        text(s, min(x1, x2) + (x2 < x1 ? 15 : 9), yy - th - 1, msgFont)
    case let .selfMsg(x, yy, s, a):
        let th = tsize(s, msgFont).height
        let dash: [CGFloat] = a == .ret ? [6, 4] : []
        text(s, x + 8, yy - th - 1, msgFont)
        line(CGPoint(x: x, y: yy), CGPoint(x: x + 32, y: yy), w: 1.1, dash: dash)
        line(CGPoint(x: x + 32, y: yy), CGPoint(x: x + 32, y: yy + 14), w: 1.1, dash: dash)
        line(CGPoint(x: x + 32, y: yy + 14), CGPoint(x: x + (a == .sync ? 9 : 1), y: yy + 14), w: 1.1, dash: dash)
        head(x, yy + 14, dir: -1, open: a != .sync)
    case let .note(x1, x2, yy, h, s):
        cg.setFillColor(NSColor.white.cgColor)
        cg.move(to: CGPoint(x: x1, y: yy)); cg.addLine(to: CGPoint(x: x2 - 9, y: yy)); cg.addLine(to: CGPoint(x: x2, y: yy + 9))
        cg.addLine(to: CGPoint(x: x2, y: yy + h)); cg.addLine(to: CGPoint(x: x1, y: yy + h)); cg.closePath()
        cg.setLineWidth(1); cg.drawPath(using: .fillStroke); cg.setFillColor(black.cgColor)
        line(CGPoint(x: x2 - 9, y: yy), CGPoint(x: x2 - 9, y: yy + 9)); line(CGPoint(x: x2 - 9, y: yy + 9), CGPoint(x: x2, y: yy + 9))
        text(s, x1 + 10, yy + 5, small)
    default: break
    }
}
for p in parts { drawHead(p, top: headTop); drawHead(p, top: footTop) }

let png = rep.representation(using: .png, properties: [:])!
try! png.write(to: URL(fileURLWithPath: args[2]))
print("\(args[2]) \(Int(width * scale))x\(Int(height * scale))")
