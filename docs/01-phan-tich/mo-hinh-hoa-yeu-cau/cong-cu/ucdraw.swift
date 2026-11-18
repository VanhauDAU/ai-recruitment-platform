// ucdraw: bộ vẽ sơ đồ use case UML (PNG nền trắng, nét đen).
// Biên dịch: swiftc -O ucdraw.swift -o ucdraw      Dùng: ./ucdraw input.uc output.png
// Cú pháp tệp .uc:
//   title Tiêu đề
//   system Tên hệ thống                (khung ranh giới hệ thống)
//   actor ID left|right Tên tác nhân
//   usecase ID cột Tên use case        (cột 1, 2 hoặc 3; thêm * sau số cột để in viền đậm, vd 2*)
//   A -- U                             (tác nhân A tham gia use case U)
//   U1 ..> U2 : include | extend       (U1 «include» U2, hoặc U1 «extend» U2)
import AppKit

let ucFont = NSFont(name: "Arial", size: 13)!
let actorFont = NSFont(name: "Arial-BoldMT", size: 13)!
let stFont = NSFont(name: "Arial", size: 12)!
let titleFont = NSFont(name: "Arial-BoldMT", size: 16)!
let sysFont = NSFont(name: "Arial-BoldMT", size: 14)!
let black = NSColor.black

func lines(_ s: String) -> [String] { s.components(separatedBy: "\n") }
func tsize(_ s: String, _ f: NSFont) -> CGSize {
    var w: CGFloat = 0
    for l in lines(s) { w = max(w, (l as NSString).size(withAttributes: [.font: f]).width) }
    return CGSize(width: ceil(w), height: CGFloat(lines(s).count) * (f.pointSize + 3.5))
}
func wrap(_ s: String, _ f: NSFont, _ maxW: CGFloat) -> String {
    var out: [String] = []
    for para in s.replacingOccurrences(of: "\\n", with: "\n").components(separatedBy: "\n") {
        var cur = ""
        for w in para.split(separator: " ").map(String.init) {
            let cand = cur.isEmpty ? w : cur + " " + w
            if !cur.isEmpty && (cand as NSString).size(withAttributes: [.font: f]).width > maxW { out.append(cur); cur = w } else { cur = cand }
        }
        out.append(cur)
    }
    return out.joined(separator: "\n")
}

struct Actor { var id: String; var label: String; var right: Bool; var x: CGFloat = 0; var y: CGFloat = 0 }
struct UC { var id: String; var label: String; var col: Int; var bold: Bool; var w: CGFloat = 0; var h: CGFloat = 0; var x: CGFloat = 0; var y: CGFloat = 0 }
struct Rel { var a: String; var b: String; var kind: String }  // kind: assoc | include | extend

let args = CommandLine.arguments
let src = try! String(contentsOfFile: args[1], encoding: .utf8)
var title = "", system = ""
var actors: [Actor] = [], ucs: [UC] = [], rels: [Rel] = []
for raw in src.components(separatedBy: "\n") {
    let line = raw.trimmingCharacters(in: .whitespaces)
    if line.isEmpty || line.hasPrefix("#") { continue }
    let p = line.split(separator: " ", maxSplits: 1).map(String.init)
    let rest = p.count > 1 ? p[1] : ""
    switch p[0] {
    case "title": title = rest
    case "system": system = rest
    case "actor":
        let q = rest.split(separator: " ", maxSplits: 2).map(String.init)
        actors.append(Actor(id: q[0], label: wrap(q[2], actorFont, 120), right: q[1] == "right"))
    case "usecase":
        let q = rest.split(separator: " ", maxSplits: 2).map(String.init)
        let bold = q[1].hasSuffix("*")
        var u = UC(id: q[0], label: wrap(q[2], ucFont, 150), col: Int(q[1].replacingOccurrences(of: "*", with: ""))!, bold: bold)
        let s = tsize(u.label, ucFont); u.w = max(s.width + 58, 150); u.h = s.height + 30
        ucs.append(u)
    default:
        if line.contains(" -- ") {
            let ab = line.components(separatedBy: " -- ").map { $0.trimmingCharacters(in: .whitespaces) }
            rels.append(Rel(a: ab[0], b: ab[1], kind: "assoc"))
        } else if line.contains("..>") {
            let parts = line.components(separatedBy: " : ")
            let ab = parts[0].components(separatedBy: "..>").map { $0.trimmingCharacters(in: .whitespaces) }
            rels.append(Rel(a: ab[0], b: ab[1], kind: parts.count > 1 ? parts[1].trimmingCharacters(in: .whitespaces) : "include"))
        } else { fatalError("cannot parse: \(line)") }
    }
}
func ui(_ id: String) -> Int? { ucs.firstIndex { $0.id == id } }
func ai(_ id: String) -> Int? { actors.firstIndex { $0.id == id } }
for r in rels where (ui(r.a) == nil && ai(r.a) == nil) || ui(r.b) == nil && ai(r.b) == nil { fatalError("unknown id in \(r)") }

// ---------- bố cục ----------
let vGap: CGFloat = 26, colGap: CGFloat = 130
let titleH: CGFloat = title.isEmpty ? 16 : 52
let sysTop = titleH + 6, sysPad: CGFloat = 34
let firstY = sysTop + (system.isEmpty ? 16 : 44)
let maxCol = ucs.map(\.col).max() ?? 1
var colW = [CGFloat](repeating: 0, count: maxCol + 1)
for u in ucs { colW[u.col] = max(colW[u.col], u.w) }
let leftActors = actors.contains { !$0.right }
let actorZone: CGFloat = 150
let sysLeft: CGFloat = (leftActors ? actorZone : 30)
var colX = [CGFloat](repeating: 0, count: maxCol + 1)
var cur = sysLeft + sysPad
for c in 1...maxCol where colW[c] > 0 { colX[c] = cur + colW[c] / 2; cur += colW[c] + colGap }
let sysRight = cur - colGap + sysPad

func linked(_ id: String) -> [String] {
    rels.compactMap { r in r.a == id ? r.b : (r.b == id ? r.a : nil) }
}
for c in 1...maxCol {
    var idxs = ucs.indices.filter { ucs[$0].col == c }
    var desired: [Int: CGFloat] = [:]
    var seq = firstY
    for i in idxs {
        let ys = linked(ucs[i].id).compactMap { id -> CGFloat? in
            guard let j = ui(id), ucs[j].col < c else { return nil }
            return ucs[j].y
        }
        desired[i] = c == 1 || ys.isEmpty ? seq : ys.reduce(0, +) / CGFloat(ys.count) - ucs[i].h / 2
        seq += ucs[i].h + vGap
    }
    if c > 1 { idxs.sort { desired[$0]! < desired[$1]! } }
    var floor = firstY
    for i in idxs {
        ucs[i].y = max(desired[i]!, floor) + ucs[i].h / 2  // y = tâm
        ucs[i].x = c == 1 ? colX[c] - (colW[c] - ucs[i].w) / 2 : (c == maxCol && c > 1 ? colX[c] + (colW[c] - ucs[i].w) / 2 : colX[c])
        floor = ucs[i].y + ucs[i].h / 2 + vGap
    }
}
let ucBottom = ucs.map { $0.y + $0.h / 2 }.max() ?? firstY
let sysBottom = ucBottom + 26
for side in [false, true] {
    var idxs = actors.indices.filter { actors[$0].right == side }
    for i in idxs {
        let ys = linked(actors[i].id).compactMap { ui($0) }.map { ucs[$0].y }
        actors[i].y = ys.isEmpty ? firstY + 60 : ys.reduce(0, +) / CGFloat(ys.count)
        actors[i].x = side ? sysRight + actorZone / 2 + 10 : actorZone / 2 + 4
    }
    idxs.sort { actors[$0].y < actors[$1].y }
    var floor = firstY + 30
    for i in idxs { actors[i].y = max(actors[i].y, floor); floor = actors[i].y + 120 }
}
let actorBottom = actors.map { $0.y + 60 + tsize($0.label, actorFont).height }.max() ?? 0
let width = max(sysRight + (actors.contains { $0.right } ? actorZone + 20 : 30), tsize(title, titleFont).width + 60)
let height = max(sysBottom, actorBottom) + 30

// ---------- vẽ ----------
let scale: CGFloat = 2.2
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(width * scale), pixelsHigh: Int(height * scale),
                           bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                           colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
let cg = NSGraphicsContext(bitmapImageRep: rep)!.cgContext
cg.translateBy(x: 0, y: height * scale); cg.scaleBy(x: scale, y: -scale)
NSGraphicsContext.current = NSGraphicsContext(cgContext: cg, flipped: true)
cg.setFillColor(NSColor.white.cgColor); cg.fill(CGRect(x: 0, y: 0, width: width, height: height))
cg.setStrokeColor(black.cgColor); cg.setFillColor(black.cgColor)

func text(_ s: String, _ x: CGFloat, _ y: CGFloat, _ f: NSFont) {
    var yy = y
    for l in lines(s) {
        let w = (l as NSString).size(withAttributes: [.font: f]).width
        (l as NSString).draw(at: CGPoint(x: x - w / 2, y: yy), withAttributes: [.font: f, .foregroundColor: black])
        yy += f.pointSize + 3.5
    }
}
func edge(_ u: UC, toward p: CGPoint) -> CGPoint {
    let dx = p.x - u.x, dy = p.y - u.y, a = u.w / 2, b = u.h / 2
    let t = 1 / sqrt((dx / a) * (dx / a) + (dy / b) * (dy / b))
    return CGPoint(x: u.x + t * dx, y: u.y + t * dy)
}

if !title.isEmpty { text(title, width / 2, 16, titleFont) }
if !system.isEmpty {
    cg.setLineWidth(1.5); cg.stroke(CGRect(x: sysLeft, y: sysTop, width: sysRight - sysLeft, height: sysBottom - sysTop))
    text(system, (sysLeft + sysRight) / 2, sysTop + 12, sysFont)
}
// đường liên kết tác nhân – use case
for r in rels where r.kind == "assoc" {
    let (aid, uid) = ai(r.a) != nil ? (r.a, r.b) : (r.b, r.a)
    guard let a = ai(aid), let u = ui(uid) else { continue }
    let ac = CGPoint(x: actors[a].x + (actors[a].right ? -14 : 14), y: actors[a].y)
    let side = actors[a].right ? ucs[u].x + ucs[u].w / 2 : ucs[u].x - ucs[u].w / 2
    let reachable = actors[a].right ? side >= sysRight - sysPad - 2 : ucs[u].col == 1
    let e = reachable ? CGPoint(x: side, y: ucs[u].y) : edge(ucs[u], toward: ac)
    cg.setLineWidth(1.1); cg.setLineDash(phase: 0, lengths: [])
    cg.move(to: ac); cg.addLine(to: e); cg.strokePath()
}
// «include» / «extend»
for r in rels where r.kind != "assoc" {
    guard let i = ui(r.a), let j = ui(r.b) else { continue }
    let p1 = edge(ucs[i], toward: CGPoint(x: ucs[j].x, y: ucs[j].y))
    let p2 = edge(ucs[j], toward: CGPoint(x: ucs[i].x, y: ucs[i].y))
    cg.setLineWidth(1.1); cg.setLineDash(phase: 0, lengths: [6, 4])
    cg.move(to: p1); cg.addLine(to: p2); cg.strokePath(); cg.setLineDash(phase: 0, lengths: [])
    let ang = atan2(p2.y - p1.y, p2.x - p1.x)
    for s: CGFloat in [1, -1] {
        cg.move(to: p2)
        cg.addLine(to: CGPoint(x: p2.x - 11 * cos(ang) + s * 5.5 * sin(ang), y: p2.y - 11 * sin(ang) - s * 5.5 * cos(ang)))
        cg.strokePath()
    }
    let label = "«\(r.kind)»"
    let mid = CGPoint(x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2)
    let sz = tsize(label, stFont)
    let lr = CGRect(x: mid.x - sz.width / 2 - 2, y: mid.y - sz.height / 2 - 1, width: sz.width + 4, height: sz.height + 2)
    cg.setFillColor(NSColor.white.cgColor); cg.fill(lr); cg.setFillColor(black.cgColor)
    text(label, mid.x, lr.minY + 1, stFont)
}
// use case
for u in ucs {
    let r = CGRect(x: u.x - u.w / 2, y: u.y - u.h / 2, width: u.w, height: u.h)
    cg.setFillColor(NSColor.white.cgColor); cg.fillEllipse(in: r); cg.setFillColor(black.cgColor)
    cg.setLineWidth(u.bold ? 2.6 : 1.2); cg.strokeEllipse(in: r)
    text(u.label, u.x, u.y - tsize(u.label, ucFont).height / 2, ucFont)
}
// tác nhân
for a in actors {
    let cx = a.x, t = a.y - 36
    cg.setLineWidth(1.4)
    cg.setFillColor(NSColor.white.cgColor)
    let head = CGRect(x: cx - 9, y: t, width: 18, height: 18)
    cg.fillEllipse(in: head); cg.setFillColor(black.cgColor); cg.strokeEllipse(in: head)
    cg.move(to: CGPoint(x: cx, y: t + 18)); cg.addLine(to: CGPoint(x: cx, y: t + 44))
    cg.move(to: CGPoint(x: cx - 16, y: t + 27)); cg.addLine(to: CGPoint(x: cx + 16, y: t + 27))
    cg.move(to: CGPoint(x: cx, y: t + 44)); cg.addLine(to: CGPoint(x: cx - 13, y: t + 62))
    cg.move(to: CGPoint(x: cx, y: t + 44)); cg.addLine(to: CGPoint(x: cx + 13, y: t + 62))
    cg.strokePath()
    let ls = tsize(a.label, actorFont)
    cg.setFillColor(NSColor.white.cgColor)
    cg.fill(CGRect(x: cx - ls.width / 2 - 3, y: t + 65, width: ls.width + 6, height: ls.height + 2))
    cg.setFillColor(black.cgColor)
    text(a.label, cx, t + 66, actorFont)
}

let png = rep.representation(using: .png, properties: [:])!
try! png.write(to: URL(fileURLWithPath: args[2]))
print("\(args[2]) \(Int(width * scale))x\(Int(height * scale))")
