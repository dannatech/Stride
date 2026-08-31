import Foundation

struct RunPacket {
    var pace: Double               // seconds per mile, 0 if unknown
    var lat: Double
    var lon: Double
    var heartRate: Double          // bpm
    var groundContactTime: Double  // ms
    var verticalOscillation: Double // cm
    var strideLength: Double       // meters
    var power: Double              // watts
    var elapsedSeconds: Double

    var asDictionary: [String: Any] {
        [
            "pace": pace,
            "lat": lat,
            "lon": lon,
            "heartRate": heartRate,
            "groundContactTime": groundContactTime,
            "verticalOscillation": verticalOscillation,
            "strideLength": strideLength,
            "power": power,
            "elapsedSeconds": elapsedSeconds,
        ]
    }
}
