import CoreGraphics
import Foundation
import ImageIO
import Vision

struct OcrLine: Codable {
	let text: String
	let confidence: Double
}

struct OcrOutput: Codable {
	let ok: Bool
	let text: String
	let lines: [OcrLine]
	let confidence: Double
	let durationMs: Int
	let error: String?
}

func writeJson(_ output: OcrOutput) {
	do {
		let data = try JSONEncoder().encode(output)
		FileHandle.standardOutput.write(data)
		FileHandle.standardOutput.write(Data([0x0A]))
	} catch {
		FileHandle.standardOutput.write(Data("{\"ok\":false,\"error\":\"encode_failed\"}\n".utf8))
	}
}

func loadCgImage(path: String) -> CGImage? {
	let url = URL(fileURLWithPath: path)
	guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
	return CGImageSourceCreateImageAtIndex(source, 0, nil)
}

let started = Date()

guard CommandLine.arguments.count >= 2 else {
	writeJson(
		OcrOutput(
			ok: false,
			text: "",
			lines: [],
			confidence: 0,
			durationMs: 0,
			error: "missing_path"
		)
	)
	exit(2)
}

let path = CommandLine.arguments[1]
guard let image = loadCgImage(path: path) else {
	writeJson(
		OcrOutput(
			ok: false,
			text: "",
			lines: [],
			confidence: 0,
			durationMs: 0,
			error: "invalid_image"
		)
	)
	exit(3)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: image, options: [:])

do {
	try handler.perform([request])
	let observations = request.results as? [VNRecognizedTextObservation] ?? []

	var lines: [OcrLine] = []
	lines.reserveCapacity(observations.count)

	for obs in observations {
		if let candidate = obs.topCandidates(1).first {
			let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
			if !text.isEmpty {
				lines.append(OcrLine(text: text, confidence: Double(candidate.confidence)))
			}
		}
	}

	let fullText = lines.map(\.text).joined(separator: "\n")
	let avgConfidence =
		lines.isEmpty
		? 0
		: lines.map(\.confidence).reduce(0, +) / Double(lines.count)
	let durationMs = Int(Date().timeIntervalSince(started) * 1000)

	writeJson(
		OcrOutput(
			ok: true,
			text: fullText,
			lines: lines,
			confidence: avgConfidence,
			durationMs: durationMs,
			error: nil
		)
	)
	exit(0)
} catch {
	let durationMs = Int(Date().timeIntervalSince(started) * 1000)
	writeJson(
		OcrOutput(
			ok: false,
			text: "",
			lines: [],
			confidence: 0,
			durationMs: durationMs,
			error: String(describing: error)
		)
	)
	exit(4)
}

