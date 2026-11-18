// actdraw: bộ vẽ sơ đồ hoạt động UML (PNG nền trắng, nét đen).
// Biên dịch: swiftc -O actdraw.swift -o actdraw      Dùng: ./actdraw input.act output.png
// Cú pháp tệp .act (thụt lề chỉ để dễ đọc):
//   title Tiêu đề
//   Hành động                 (mỗi dòng thường là một hành động)
//   if Câu hỏi?               (nút quyết định)
//   case Có                   (một nhánh, nhãn điều kiện in trong [ ])
//   ...
//   endif                     (nút gộp; nhánh kết thúc bằng stop không nối vào nút gộp)
//   while Câu hỏi? | Có | Không   (vòng lặp: nhãn nhánh lặp | nhãn nhánh thoát)
//   ...
//   endwhile
//   fork ... again ... endfork    (thực hiện song song)
//   stop                      (nút kết thúc)
import AppKit

let actFont = NSFont(name: "Arial", size: 13)!
let guardFont = NSFont(name: "Arial", size: 12)!
let titleFont = NSFont(name: "Arial-BoldMT", size: 16)!
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

indirect enum Node {
    case action(String)
    case stop
    case branch(String, [(String, [Node])])
    case loop(String, String, String, [Node])
    case fork([[Node]])
}

// ---------- đọc tệp ----------
let args = CommandLine.arguments
let src = try! String(contentsOfFile: args[1], encoding: .utf8)
var title = ""
enum Frame { case br(String, [(String, [Node])]), lp(String, String, String, [Node]), fk([[Node]]) }
var stack: [Frame] = []
var root: [Node] = []
func add(_ n: Node) {
    guard let top = stack.popLast() else { root.append(n); return }
    switch top {
    case var .br(q, arms): arms[arms.count - 1].1.append(n); stack.append(.br(q, arms))
    case .lp(let q, let a, let b, var body): body.append(n); stack.append(.lp(q, a, b, body))
    case var .fk(arms): arms[arms.count - 1].append(n); stack.append(.fk(arms))
    }
}
for raw in src.components(separatedBy: "\n") {
    let line = raw.trimmingCharacters(in: .whitespaces)
    if line.isEmpty || line.hasPrefix("#") { continue }
    let p = line.split(separator: " ", maxSplits: 1).map(String.init)
    let kw = p[0], rest = p.count > 1 ? p[1] : ""
    switch kw {
    case "title": title = rest
    case "if": stack.append(.br(rest, []))
    case "case":
        guard case var .br(q, arms) = stack.removeLast() else { fatalError("case outside if: \(line)") }
        arms.append((rest, [])); stack.append(.br(q, arms))
    case "endif":
        guard case let .br(q, arms) = stack.removeLast() else { fatalError("bad endif") }
        add(.branch(q, arms))
    case "while":
        let s = rest.components(separatedBy: "|").map { $0.trimmingCharacters(in: .whitespaces) }
        stack.append(.lp(s[0], s.count > 1 ? s[1] : "Có", s.count > 2 ? s[2] : "Không", []))
    case "endwhile":
        guard case let .lp(q, a, b, body) = stack.removeLast() else { fatalError("bad endwhile") }
        add(.loop(q, a, b, body))
    case "fork": stack.append(.fk([[]]))
    case "again":
        guard case var .fk(arms) = stack.removeLast() else { fatalError("again outside fork") }
        arms.append([]); stack.append(.fk(arms))
    case "endfork":
        guard case let .fk(arms) = stack.removeLast() else { fatalError("bad endfork") }
        add(.fork(arms))
    case "stop": add(.stop)
    default: add(.action(line))
    }
}
if !stack.isEmpty { fatalError("unclosed block in \(args[1])") }

// ---------- đo kích thước ----------
struct Box { var w: CGFloat; var h: CGFloat; var cx: CGFloat; var term: Bool }
let gapY: CGFloat = 24, armGap: CGFloat = 26, armTop: CGFloat = 30, stopR: CGFloat = 11
func diamond(_ q: String) -> (String, CGFloat, CGFloat) {
    let t = wrap(q, guardFont, 170); let s = tsize(t, guardFont)
    return (t, s.width + 40, max(s.height + 16, 30))
}
func guardText(_ s: String) -> String { s.isEmpty ? "" : "[\(s)]" }
func measure(_ n: Node) -> Box {
    switch n {
    case let .action(t):
        let s = tsize(wrap(t, actFont, 210), actFont)
        return Box(w: s.width + 26, h: s.height + 16, cx: (s.width + 26) / 2, term: false)
    case .stop: return Box(w: stopR * 2, h: stopR * 2, cx: stopR, term: true)
    case let .branch(q, arms):
        let (_, dw, dh) = diamond(q)
        let multi = arms.filter { !$0.1.isEmpty }.count >= 2
        let boxes = arms.map { arm -> Box in
            var b = arm.1.isEmpty ? Box(w: 30, h: 0, cx: 15, term: false) : withNoLane(multi) { measureSeq(arm.1) }
            let gw = tsize(guardText(arm.0), guardFont).width + 8
            if b.w - b.cx < gw { b.w = b.cx + gw }  // chỗ cho nhãn điều kiện bên phải đường nhánh
            return b
        }
        let W = boxes.reduce(0) { $0 + $1.w } + armGap * CGFloat(max(boxes.count - 1, 0))
        let firstC = boxes[0].cx, lastC = W - boxes.last!.w + boxes.last!.cx
        let mid = (firstC + lastC) / 2
        let left = max(mid, dw / 2), right = max(W - mid, dw / 2)
        let maxH = boxes.map(\.h).max()!
        let allTerm = boxes.allSatisfy(\.term)
        return Box(w: left + right, h: dh + armTop + maxH + (allTerm ? 0 : 34), cx: left, term: allTerm)
    case let .loop(q, _, b, body):
        let (_, dw, dh) = diamond(q)
        let bb = measureSeq(body)
        let gw = tsize(guardText(b), guardFont).width
        let left = max(bb.cx + 22, dw / 2 + 4), right = max(bb.w - bb.cx + 22, dw / 2 + 12 + gw)
        return Box(w: left + right, h: dh + armTop + bb.h + 34, cx: left, term: false)
    case let .fork(arms):
        let boxes = arms.map(measureSeq)
        let W = boxes.reduce(0) { $0 + $1.w } + armGap * CGFloat(boxes.count - 1)
        return Box(w: W + 20, h: 6 + armTop + boxes.map(\.h).max()! + armTop + 6, cx: (W + 20) / 2, term: false)
    }
}
// Quyết định "chặn lỗi": mọi nhánh kết thúc bằng stop, trừ đúng một nhánh rỗng đi tiếp.
// Các nhánh lỗi được đặt vào làn bên trái, luồng chính đi thẳng xuống để sơ đồ không bị kéo dài.
struct Guard { var q: String; var arms: [(String, [Node], Box)]; var openLabel: String; var laneW: CGFloat; var armsH: CGFloat }
var noLane = 0  // > 0 khi đang ở trong các nhánh song song có nội dung: giữ cách xếp cạnh nhau cho gọn chiều ngang
func withNoLane<T>(_ on: Bool, _ f: () -> T) -> T { if on { noLane += 1 }; defer { if on { noLane -= 1 } }; return f() }
func guardInfo(_ n: Node) -> Guard? {
    guard noLane == 0, case let .branch(q, arms) = n, arms.count >= 2 else { return nil }
    let open = arms.filter { $0.1.isEmpty }
    let closed = arms.filter { !$0.1.isEmpty }
    guard open.count == 1, closed.count == arms.count - 1, closed.allSatisfy({ measureSeq($0.1).term }) else { return nil }
    let boxed = closed.map { arm -> (String, [Node], Box) in
        var b = measureSeq(arm.1)
        let gw = tsize(guardText(arm.0), guardFont).width + 8
        if b.w - b.cx < gw { b.w = b.cx + gw }
        return (arm.0, arm.1, b)
    }
    let w = boxed.reduce(0) { $0 + $1.2.w } + armGap * CGFloat(boxed.count - 1)
    return Guard(q: q, arms: boxed, openLabel: open[0].0, laneW: w, armsH: boxed.map { $0.2.h }.max()!)
}
let laneGap: CGFloat = 34, laneDrop: CGFloat = 24
func layoutSeq(_ ns: [Node]) -> (Box, [CGFloat], CGFloat) {
    var L: CGFloat = 0, R: CGFloat = 0, lane: CGFloat = 0
    var mains: [Box] = []
    for n in ns {
        if let g = guardInfo(n) {
            let (_, dw, dh) = diamond(g.q)
            let gl = tsize(guardText(g.openLabel), guardFont).width + 10
            mains.append(Box(w: dw / 2 + max(dw / 2, gl), h: dh, cx: dw / 2, term: false))
            lane = max(lane, g.laneW)
        } else { mains.append(measure(n)) }
    }
    for b in mains { L = max(L, b.cx); R = max(R, b.w - b.cx) }
    if lane > 0 { lane += laneGap }
    var ys: [CGFloat] = [], y: CGFloat = 0, laneBottom: CGFloat = -1000
    for (i, n) in ns.enumerated() {
        if i > 0 { y += gapY }
        if let g = guardInfo(n) {
            let dh = mains[i].h
            y = max(y, laneBottom + 10 - dh / 2)
            ys.append(y)
            laneBottom = y + dh / 2 + laneDrop + g.armsH
        } else { ys.append(y) }
        y += mains[i].h
    }
    let h = max(y, laneBottom)
    let term = guardInfo(ns.last ?? .stop) == nil ? (ns.last.map { measure($0).term } ?? false) : false
    return (Box(w: lane + L + R, h: h, cx: lane + L, term: term), ys, lane)
}
func measureSeq(_ ns: [Node]) -> Box { layoutSeq(ns).0 }

// ---------- vẽ ----------
var nodes: [Node] = root
let body = measureSeq(nodes)
let startR: CGFloat = 10
let titleH: CGFloat = title.isEmpty ? 10 : 46
let margin: CGFloat = 30
let width = max(body.w + margin * 2, tsize(title, titleFont).width + 60)
let needEnd = !body.term
let height = titleH + startR * 2 + gapY + body.h + (needEnd ? gapY + stopR * 2 : 0) + margin
let scale: CGFloat = 2.2
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(width * scale), pixelsHigh: Int(height * scale),
                           bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                           colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
let cg = NSGraphicsContext(bitmapImageRep: rep)!.cgContext
cg.translateBy(x: 0, y: height * scale); cg.scaleBy(x: scale, y: -scale)
NSGraphicsContext.current = NSGraphicsContext(cgContext: cg, flipped: true)
cg.setFillColor(NSColor.white.cgColor); cg.fill(CGRect(x: 0, y: 0, width: width, height: height))
cg.setStrokeColor(black.cgColor); cg.setFillColor(black.cgColor); cg.setLineWidth(1.2)

func text(_ s: String, _ x: CGFloat, _ y: CGFloat, _ f: NSFont, center: Bool = true) {
    var yy = y
    for l in lines(s) {
        let w = (l as NSString).size(withAttributes: [.font: f]).width
        (l as NSString).draw(at: CGPoint(x: center ? x - w / 2 : x, y: yy), withAttributes: [.font: f, .foregroundColor: black])
        yy += f.pointSize + 3.5
    }
}
func poly(_ pts: [CGPoint], arrow: Bool = true) {
    cg.setLineWidth(1.2)
    cg.move(to: pts[0]); for p in pts.dropFirst() { cg.addLine(to: p) }; cg.strokePath()
    if arrow, pts.count >= 2 {
        let a = pts[pts.count - 2], b = pts[pts.count - 1]
        let ang = atan2(b.y - a.y, b.x - a.x)
        let p1 = CGPoint(x: b.x - 9 * cos(ang) + 4.5 * sin(ang), y: b.y - 9 * sin(ang) - 4.5 * cos(ang))
        let p2 = CGPoint(x: b.x - 9 * cos(ang) - 4.5 * sin(ang), y: b.y - 9 * sin(ang) + 4.5 * cos(ang))
        cg.move(to: b); cg.addLine(to: p1); cg.addLine(to: p2); cg.closePath(); cg.fillPath()
    }
}
func drawDiamond(_ cx: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ t: String) {
    cg.setFillColor(NSColor.white.cgColor)
    if t.isEmpty {  // nút gộp: hình thoi
        cg.move(to: CGPoint(x: cx, y: y)); cg.addLine(to: CGPoint(x: cx + w / 2, y: y + h / 2))
        cg.addLine(to: CGPoint(x: cx, y: y + h)); cg.addLine(to: CGPoint(x: cx - w / 2, y: y + h / 2)); cg.closePath()
    } else {  // nút quyết định: hình thoi dẹt (lục giác) để chứa câu hỏi
        let k: CGFloat = 14
        cg.move(to: CGPoint(x: cx - w / 2, y: y + h / 2)); cg.addLine(to: CGPoint(x: cx - w / 2 + k, y: y))
        cg.addLine(to: CGPoint(x: cx + w / 2 - k, y: y)); cg.addLine(to: CGPoint(x: cx + w / 2, y: y + h / 2))
        cg.addLine(to: CGPoint(x: cx + w / 2 - k, y: y + h)); cg.addLine(to: CGPoint(x: cx - w / 2 + k, y: y + h)); cg.closePath()
    }
    cg.setLineWidth(1.2); cg.drawPath(using: .fillStroke); cg.setFillColor(black.cgColor)
    if !t.isEmpty { text(t, cx, y + (h - tsize(t, guardFont).height) / 2, guardFont) }
}
func drawStop(_ cx: CGFloat, _ y: CGFloat) {
    cg.setLineWidth(1.3); cg.strokeEllipse(in: CGRect(x: cx - stopR, y: y, width: stopR * 2, height: stopR * 2))
    cg.fillEllipse(in: CGRect(x: cx - 6.5, y: y + stopR - 6.5, width: 13, height: 13))
}

// vẽ một nút có mép trái ở x, đỉnh ở y; trả về nhãn của đường ra (nếu có)
func draw(_ n: Node, _ x: CGFloat, _ y: CGFloat) {
    let b = measure(n); let cx = x + b.cx
    switch n {
    case let .action(t):
        let r = CGRect(x: x, y: y, width: b.w, height: b.h)
        let path = CGPath(roundedRect: r, cornerWidth: 10, cornerHeight: 10, transform: nil)
        cg.setFillColor(NSColor.white.cgColor); cg.addPath(path); cg.fillPath()
        cg.setFillColor(black.cgColor); cg.addPath(path); cg.setLineWidth(1.2); cg.strokePath()
        let tt = wrap(t, actFont, 210)
        text(tt, cx, y + 8, actFont)
    case .stop: drawStop(cx, y)
    case let .branch(q, arms):
        let (dt, dw, dh) = diamond(q)
        drawDiamond(cx, y, dw, dh, dt)
        let multi = arms.filter { !$0.1.isEmpty }.count >= 2
        let boxes = arms.map { arm -> Box in
            var bb = arm.1.isEmpty ? Box(w: 30, h: 0, cx: 15, term: false) : withNoLane(multi) { measureSeq(arm.1) }
            let gw = tsize(guardText(arm.0), guardFont).width + 8
            if bb.w - bb.cx < gw { bb.w = bb.cx + gw }
            return bb
        }
        let W = boxes.reduce(0) { $0 + $1.w } + armGap * CGFloat(max(boxes.count - 1, 0))
        let mid = (boxes[0].cx + W - boxes.last!.w + boxes.last!.cx) / 2
        var ax = cx - mid
        let top = y + dh + armTop
        let maxH = boxes.map(\.h).max()!
        let mergeY = top + maxH + 16
        let openArms = boxes.filter { !$0.term }.count
        let openIdx = boxes.indices.filter { !boxes[$0].term }
        for (i, arm) in arms.enumerated() {
            let bb = boxes[i]; let acx = ax + bb.cx
            if acx < cx - dw / 2 + 1 { poly([CGPoint(x: cx - dw / 2, y: y + dh / 2), CGPoint(x: acx, y: y + dh / 2), CGPoint(x: acx, y: top)], arrow: !arm.1.isEmpty) }
            else if acx > cx + dw / 2 - 1 { poly([CGPoint(x: cx + dw / 2, y: y + dh / 2), CGPoint(x: acx, y: y + dh / 2), CGPoint(x: acx, y: top)], arrow: !arm.1.isEmpty) }
            else { poly([CGPoint(x: cx, y: y + dh), CGPoint(x: cx, y: y + dh + 10), CGPoint(x: acx, y: y + dh + 10), CGPoint(x: acx, y: top)], arrow: !arm.1.isEmpty) }
            text(guardText(arm.0), acx + 5, top - 17, guardFont, center: false)
            if !arm.1.isEmpty { withNoLane(multi) { drawSeq(arm.1, ax + bb.cx - measureSeq(arm.1).cx, top) } }
            if !bb.term {
                let from = CGPoint(x: acx, y: top + bb.h)
                if openArms == 1 {  // chỉ một nhánh đi tiếp: nối thẳng về trục, không cần nút gộp
                    poly([from, CGPoint(x: acx, y: mergeY + 9), CGPoint(x: cx, y: mergeY + 9), CGPoint(x: cx, y: mergeY + 18)], arrow: false)
                } else if abs(acx - cx) < 1 { poly([from, CGPoint(x: cx, y: mergeY)]) }
                else if i != openIdx.first && i != openIdx.last {  // nhánh giữa vào đỉnh nút gộp
                    poly([from, CGPoint(x: acx, y: mergeY - 8), CGPoint(x: cx, y: mergeY - 8), CGPoint(x: cx, y: mergeY)])
                }
                else { poly([from, CGPoint(x: acx, y: mergeY + 9), CGPoint(x: acx < cx ? cx - 9 : cx + 9, y: mergeY + 9)]) }
            }
            ax += bb.w + armGap
        }
        if openArms > 1 { drawDiamond(cx, mergeY, 18, 18, "") }
        if !b.term { cg.move(to: CGPoint(x: cx, y: mergeY + 18)); cg.addLine(to: CGPoint(x: cx, y: y + b.h)); cg.strokePath() }
    case let .loop(q, a, e, bodyN):
        let (dt, dw, dh) = diamond(q)
        drawDiamond(cx, y, dw, dh, dt)
        let bb = measureSeq(bodyN)
        let top = y + dh + armTop
        poly([CGPoint(x: cx, y: y + dh), CGPoint(x: cx, y: top)])
        text(guardText(a), cx + 5, top - 17, guardFont, center: false)
        drawSeq(bodyN, cx - bb.cx, top)
        let backX = x + 6, exitX = x + b.w - 6, bottom = top + bb.h
        poly([CGPoint(x: cx, y: bottom), CGPoint(x: cx, y: bottom + 12), CGPoint(x: backX, y: bottom + 12),
              CGPoint(x: backX, y: y + dh / 2), CGPoint(x: cx - dw / 2, y: y + dh / 2)])
        poly([CGPoint(x: cx + dw / 2, y: y + dh / 2), CGPoint(x: exitX, y: y + dh / 2), CGPoint(x: exitX, y: y + b.h - 6),
              CGPoint(x: cx, y: y + b.h - 6)], arrow: false)
        cg.move(to: CGPoint(x: cx, y: y + b.h - 6)); cg.addLine(to: CGPoint(x: cx, y: y + b.h)); cg.strokePath()
        text(guardText(e), cx + dw / 2 + 6, y + dh / 2 - 17, guardFont, center: false)
    case let .fork(arms):
        let boxes = arms.map(measureSeq)
        let W = boxes.reduce(0) { $0 + $1.w } + armGap * CGFloat(boxes.count - 1)
        var ax = x + 10
        let top = y + 6 + armTop, joinY = y + b.h - 6
        cg.fill(CGRect(x: x + 10 + boxes[0].cx - 10, y: y, width: W - boxes[0].cx - (boxes.last!.w - boxes.last!.cx) + 20, height: 5))
        cg.fill(CGRect(x: x + 10 + boxes[0].cx - 10, y: joinY, width: W - boxes[0].cx - (boxes.last!.w - boxes.last!.cx) + 20, height: 5))
        for (i, arm) in arms.enumerated() {
            let acx = ax + boxes[i].cx
            poly([CGPoint(x: acx, y: y + 5), CGPoint(x: acx, y: top)])
            drawSeq(arm, ax, top)
            if !boxes[i].term { poly([CGPoint(x: acx, y: top + boxes[i].h), CGPoint(x: acx, y: joinY)]) }
            ax += boxes[i].w + armGap
        }
        cg.move(to: CGPoint(x: cx, y: joinY + 5)); cg.addLine(to: CGPoint(x: cx, y: y + b.h)); cg.strokePath()
    }
}
func drawSeq(_ ns: [Node], _ x: CGFloat, _ y: CGFloat) {
    let (sb, ys, lane) = layoutSeq(ns)
    let axis = x + sb.cx
    var prevBottom: CGFloat? = nil
    for (i, n) in ns.enumerated() {
        let top = y + ys[i]
        if let pb = prevBottom { poly([CGPoint(x: axis, y: pb), CGPoint(x: axis, y: top)]) }
        if let g = guardInfo(n) {
            let (dt, dw, dh) = diamond(g.q)
            drawDiamond(axis, top, dw, dh, dt)
            let hy = top + dh / 2, armTopY = hy + laneDrop
            var ax = x + lane - laneGap - g.laneW
            let firstC = ax + g.arms[0].2.cx
            poly([CGPoint(x: axis - dw / 2, y: hy), CGPoint(x: firstC, y: hy)], arrow: false)
            for arm in g.arms {
                let acx = ax + arm.2.cx
                poly([CGPoint(x: acx, y: hy), CGPoint(x: acx, y: armTopY)])
                text(guardText(arm.0), acx + 4, hy + 3, guardFont, center: false)
                drawSeq(arm.1, acx - measureSeq(arm.1).cx, armTopY)
                ax += arm.2.w + armGap
            }
            text(guardText(g.openLabel), axis + 5, top + dh + 2, guardFont, center: false)
            prevBottom = top + dh
        } else {
            let b = measure(n)
            draw(n, axis - b.cx, top)
            prevBottom = top + b.h
        }
    }
}

if !title.isEmpty { text(title, width / 2, 16, titleFont) }
let ox = (width - body.w) / 2, cxMain = ox + body.cx
var yy = titleH
cg.fillEllipse(in: CGRect(x: cxMain - startR, y: yy, width: startR * 2, height: startR * 2))
yy += startR * 2
poly([CGPoint(x: cxMain, y: yy), CGPoint(x: cxMain, y: yy + gapY)]); yy += gapY
drawSeq(nodes, ox, yy); yy += body.h
if needEnd { poly([CGPoint(x: cxMain, y: yy), CGPoint(x: cxMain, y: yy + gapY)]); drawStop(cxMain, yy + gapY) }

let png = rep.representation(using: .png, properties: [:])!
try! png.write(to: URL(fileURLWithPath: args[2]))
print("\(args[2]) \(Int(width * scale))x\(Int(height * scale))")
