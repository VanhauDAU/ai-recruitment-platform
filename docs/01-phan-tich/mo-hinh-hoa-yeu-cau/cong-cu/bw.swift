// bw: chuyển ảnh sơ đồ sang trắng đen (bỏ màu nền nhạt), giữ nét và chữ.
// Dùng: ./bw input.png output.png
import AppKit
let a = CommandLine.arguments
let src = NSBitmapImageRep(data: try! Data(contentsOf: URL(fileURLWithPath: a[1])))!
let w = src.pixelsWide, h = src.pixelsHigh
let out = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8, samplesPerPixel: 4,
                           hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
for y in 0..<h { for x in 0..<w {
    let c = src.colorAt(x: x, y: y)?.usingColorSpace(.deviceRGB) ?? .white
    let alpha = c.alphaComponent
    var l = (0.299 * c.redComponent + 0.587 * c.greenComponent + 0.114 * c.blueComponent) * alpha + (1 - alpha)
    if l > 0.86 { l = 1 }  // nền màu nhạt → trắng
    out.setColor(NSColor(deviceRed: l, green: l, blue: l, alpha: 1), atX: x, y: y)
} }
try! out.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[2]))
print(a[2], w, h)
