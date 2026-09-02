import Foundation

public struct RunPacket {
    public var pace: Double               // seconds per mile, 0 if unknown
    public var lat: Double
    public var lon: Double
    public var heartRate: Double          // bpm
    public var groundContactTime: Double  // ms
    public var verticalOscillation: Double // cm
    public var strideLength: Double       // meters
    public var power: Double              // watts
    public var elapsedSeconds: Double
    public var workoutState: String

    public init(
        pace: Double,
        lat: Double,
        lon: Double,
        heartRate: Double,
        groundContactTime: Double,
        verticalOscillation: Double,
        strideLength: Double,
        power: Double,
        elapsedSeconds: Double,
        workoutState: String = "running"
    ) {
        self.pace = pace
        self.lat = lat
        self.lon = lon
        self.heartRate = heartRate
        self.groundContactTime = groundContactTime
        self.verticalOscillation = verticalOscillation
        self.strideLength = strideLength
        self.power = power
        self.elapsedSeconds = elapsedSeconds
        self.workoutState = workoutState
    }

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
            "workoutState": workoutState,
        ]
    }
}
