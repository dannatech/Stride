import Foundation

/// Payload shape sent from the phone app over WatchConnectivity.
/// Keep this in sync with `buildWatchPayload()` in mobile/App.js —
/// the watch decodes whatever subset of these keys is present.
struct WatchPayload: Codable {
    var authenticated: Bool?
    var readiness: Int?
    var cycleDay: Int?
    var cycleLength: Int?
    var periodLength: Int?
    var sprintsToday: Int?
    var coreToday: [String: Int]?
    var session: LiveSession?
    var ai: AIInsights?
}

struct LiveSession: Codable {
    var elapsed: Int
    var pace: Double     // seconds per mile
    var speed: Double     // mph
    var cadence: Double   // steps per minute
    var hr: Double        // bpm
    var laps: [Double]    // seconds per mile, one per lap
    var sprintIdx: Int

    static let placeholder = LiveSession(elapsed: 0, pace: 420, speed: 8.0, cadence: 170, hr: 120, laps: [], sprintIdx: 0)
}

struct WeeklyPlanDay: Codable, Identifiable {
    var day: String
    var focus: String
    var intensity: Int
    var id: String { day }
}

struct AIInsights: Codable {
    var postWorkoutInsight: String
    var weeklyNarrative: String
    var liveCues: [String]
    var cycleTip: String
    var coreInsight: String
    var vo2maxNote: String
    var weeklyPlan: [WeeklyPlanDay]

    static let fallback = AIInsights(
        postWorkoutInsight: "Your strongest surge came at minute 7 — you held 6:28/mi for the full interval.",
        weeklyNarrative: "Across your last four runs, average pace improved 35 seconds while sprint volume held steady.",
        liveCues: [
            "Drive your knees — hold this cadence.",
            "Relax your shoulders, quick feet.",
            "Halfway through this rep. Stay tall.",
            "Strong finish — kick for ten more seconds.",
            "Ease off. Breathe. Recover for the next one.",
        ],
        cycleTip: "You're in a high-energy window — great week for hard sprint sessions.",
        coreInsight: "You hit 4 of 6 core exercises today, plank hold improved to 48 seconds.",
        vo2maxNote: "Your estimated VO2max climbed to 47.9 ml/kg/min, up from 44.8 six weeks ago.",
        weeklyPlan: [
            WeeklyPlanDay(day: "Mon", focus: "Recovery jog + strides", intensity: 1),
            WeeklyPlanDay(day: "Tue", focus: "6 × 200m hill sprints", intensity: 3),
            WeeklyPlanDay(day: "Wed", focus: "Mobility + core", intensity: 1),
            WeeklyPlanDay(day: "Thu", focus: "8 × 150m flat sprints", intensity: 3),
            WeeklyPlanDay(day: "Fri", focus: "Easy 3 mi aerobic", intensity: 2),
            WeeklyPlanDay(day: "Sat", focus: "10 × 100m accelerations", intensity: 3),
            WeeklyPlanDay(day: "Sun", focus: "Rest + stretching", intensity: 0),
        ]
    )
}

struct CoreExerciseDef: Identifiable {
    var id: String
    var name: String
    var type: String // "hold" | "reps"
    var target: Int
    var unit: String
}

struct HistoryEntry: Identifiable {
    var id: String { date }
    var date: String
    var sprints: Int
    var distance: String
    var pace: Double // seconds per mile
}

struct CoreHistoryEntry: Identifiable {
    var id: String { date }
    var date: String
    var completed: Int
    var totalReps: Int
    var holdSec: Int
}

/// Static reference data mirroring mobile/src/data.js. These arrays are the
/// same across every session (the phone app treats them as sample data too),
/// so only the live/dynamic fields above travel over WatchConnectivity.
enum SampleData {
    static let sprintGoal = 10
    static let weekBars: [Double] = [6, 9, 4, 10, 7, 0, 8]
    static let todayIdx = 2
    static let dayLetters = ["S", "M", "T", "W", "T", "F", "S"]

    static let history: [HistoryEntry] = [
        HistoryEntry(date: "Jul 14", sprints: 8, distance: "3.2 mi", pace: 412),
        HistoryEntry(date: "Jul 12", sprints: 10, distance: "3.8 mi", pace: 425),
        HistoryEntry(date: "Jul 10", sprints: 7, distance: "2.9 mi", pace: 418),
        HistoryEntry(date: "Jul 8", sprints: 9, distance: "3.5 mi", pace: 436),
        HistoryEntry(date: "Jul 6", sprints: 6, distance: "2.6 mi", pace: 431),
        HistoryEntry(date: "Jul 4", sprints: 8, distance: "3.1 mi", pace: 447),
    ]

    static let paceMinutes: [Double] = [462, 448, 431, 395, 418, 442, 388, 402, 455, 391, 424, 438]
    static let sprintMinutes: Set<Int> = [3, 6, 9]

    static let coreExercises: [CoreExerciseDef] = [
        CoreExerciseDef(id: "plank", name: "Plank", type: "hold", target: 60, unit: "sec"),
        CoreExerciseDef(id: "situps", name: "Sit-Ups", type: "reps", target: 25, unit: "reps"),
        CoreExerciseDef(id: "twists", name: "Russian Twists", type: "reps", target: 30, unit: "reps"),
        CoreExerciseDef(id: "raises", name: "Leg Raises", type: "reps", target: 20, unit: "reps"),
        CoreExerciseDef(id: "climbers", name: "Mountain Climbers", type: "reps", target: 40, unit: "reps"),
        CoreExerciseDef(id: "crunches", name: "Bicycle Crunches", type: "reps", target: 30, unit: "reps"),
    ]
    static var coreGoal: Int { coreExercises.count }

    static let coreHistory: [CoreHistoryEntry] = [
        CoreHistoryEntry(date: "Jul 14", completed: 4, totalReps: 96, holdSec: 48),
        CoreHistoryEntry(date: "Jul 12", completed: 6, totalReps: 138, holdSec: 65),
        CoreHistoryEntry(date: "Jul 10", completed: 5, totalReps: 110, holdSec: 55),
        CoreHistoryEntry(date: "Jul 8", completed: 3, totalReps: 80, holdSec: 40),
        CoreHistoryEntry(date: "Jul 6", completed: 6, totalReps: 145, holdSec: 70),
    ]

    static let vo2maxHistory: [Double] = [44.8, 45.3, 45.9, 46.4, 46.9, 47.5, 47.9]
    static let vo2maxLabels = ["6wk", "5wk", "4wk", "3wk", "2wk", "1wk", "Now"]

    static let phaseInfo: [(name: String, range: String, desc: String, tip: String)] = [
        ("Menstrual", "Days 1–5", "Your period. Energy is typically lowest early in this phase.",
         "Keep intensity light — easy jogs, mobility, and gentle strides are ideal."),
        ("Follicular", "Days 6–13", "Rising estrogen. Energy and recovery capacity climb through this phase.",
         "Schedule your hardest sprint sessions here — your body adapts fastest now."),
        ("Ovulation", "Days 14–16", "Peak hormone levels. Power output tends to peak, but joints are laxer.",
         "Go for peak-speed work, but warm up thoroughly to protect tendons."),
        ("Luteal", "Days 17–28", "Progesterone rises. Core temperature is higher; hard efforts feel harder.",
         "Favor steady aerobic volume and technique work over max-effort sprints."),
    ]
}

// MARK: - Formatting helpers (mirrors data.js)

func fmtPace(_ secs: Double) -> String {
    let m = Int(secs) / 60
    let s = Int(secs.rounded()) % 60
    return "\(m):\(String(format: "%02d", s))"
}

func fmtClock(_ s: Int) -> String {
    let m = s / 60
    let sec = s % 60
    return "\(String(format: "%02d", m)):\(String(format: "%02d", sec))"
}

func readinessLabel(_ score: Int) -> String {
    score >= 80 ? "Great" : score >= 55 ? "Good" : "Low"
}

func phaseFor(_ day: Int) -> String {
    if day <= 5 { return "Menstrual" }
    if day <= 13 { return "Follicular" }
    if day <= 16 { return "Ovulation" }
    return "Luteal"
}

func vo2maxCategoryLabel(_ v: Double) -> String {
    if v >= 52 { return "Excellent" }
    if v >= 47 { return "Very Good" }
    if v >= 42 { return "Good" }
    if v >= 35 { return "Fair" }
    return "Below Average"
}

/// ACSM submaximal running equation: VO2 (ml/kg/min) = 0.2 × speed(m/min) + 3.5
func estimateVO2(speedMph: Double) -> Double {
    0.2 * speedMph * 26.8224 + 3.5
}
