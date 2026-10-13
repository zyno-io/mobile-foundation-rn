import Foundation

final class TrackingNotifications: NotificationCenter, @unchecked Sendable {
  var additions = 0
  var removals = 0
  override func addObserver(forName name: NSNotification.Name?, object obj: Any?, queue: OperationQueue?, using block: @escaping @Sendable (Notification) -> Void) -> NSObjectProtocol {
    additions += 1
    return super.addObserver(forName: name, object: obj, queue: queue, using: block)
  }
  override func removeObserver(_ observer: Any) {
    removals += 1
    super.removeObserver(observer)
  }
}

let changed = Notification.Name("ProtectedDataTestAvailable")
var passed = 0
func check(_ condition: @autoclosure () -> Bool, _ message: String) {
  if !condition() { fatalError(message) }
}
func test(_ name: String, _ body: () -> Void) {
  body()
  passed += 1
  print("PASS \(name)")
}

test("already available resolves without observing") {
  let notifications = TrackingNotifications()
  let service = ProtectedDataAvailability(isAvailable: { true }, notificationName: changed, notifications: notifications)
  var resolved = false
  service.wait(id: "one") { if case .success = $0 { resolved = true } }
  check(resolved && notifications.additions == 0, "must resolve immediately")
}

test("waiters share an observer and notifications recheck availability") {
  let notifications = TrackingNotifications()
  var available = false
  let service = ProtectedDataAvailability(isAvailable: { available }, notificationName: changed, notifications: notifications)
  var resolved = 0
  service.wait(id: "one") { if case .success = $0 { resolved += 1 } }
  service.wait(id: "two") { if case .success = $0 { resolved += 1 } }
  check(notifications.additions == 1, "waiters must share observer")
  notifications.post(name: changed, object: nil)
  check(resolved == 0, "notification alone cannot confirm availability")
  available = true
  notifications.post(name: changed, object: nil)
  check(resolved == 2 && notifications.removals == 1, "unlock must release all and remove observer")
}

test("unlock before observer registration is not lost") {
  let notifications = TrackingNotifications()
  var queries = 0
  let service = ProtectedDataAvailability(isAvailable: { queries += 1; return queries > 1 }, notificationName: changed, notifications: notifications)
  var resolved = false
  service.wait(id: "one") { if case .success = $0 { resolved = true } }
  check(resolved && notifications.removals == 1, "post-registration query must catch unlock")
}

test("canceling one waiter preserves others") {
  let notifications = TrackingNotifications()
  var available = false
  let service = ProtectedDataAvailability(isAvailable: { available }, notificationName: changed, notifications: notifications)
  var canceled = 0
  var resolved = 0
  service.wait(id: "one") { if case .failure = $0 { canceled += 1 } }
  service.wait(id: "two") { if case .success = $0 { resolved += 1 } }
  service.cancel(id: "one")
  check(canceled == 1 && notifications.removals == 0, "remaining waiter must keep subscription")
  available = true
  notifications.post(name: changed, object: nil)
  check(resolved == 1 && notifications.removals == 1, "remaining waiter must resume")
}

test("last cancellation and module teardown remove observers") {
  let notifications = TrackingNotifications()
  let service = ProtectedDataAvailability(isAvailable: { false }, notificationName: changed, notifications: notifications)
  var canceled = 0
  service.wait(id: "one") { if case .failure = $0 { canceled += 1 } }
  service.cancel(id: "one")
  service.wait(id: "two") { if case .failure = $0 { canceled += 1 } }
  service.wait(id: "three") { if case .failure = $0 { canceled += 1 } }
  service.cancelAll()
  check(canceled == 3 && notifications.additions == 2 && notifications.removals == 2, "all waits must settle and clean up")
}

test("a later lock creates a fresh wait") {
  let notifications = TrackingNotifications()
  var available = true
  let service = ProtectedDataAvailability(isAvailable: { available }, notificationName: changed, notifications: notifications)
  var resolved = 0
  service.wait(id: "one") { if case .success = $0 { resolved += 1 } }
  available = false
  service.wait(id: "two") { if case .success = $0 { resolved += 1 } }
  check(resolved == 1, "later lock must block the new operation")
  available = true
  notifications.post(name: changed, object: nil)
  check(resolved == 2, "later unlock must release it")
}

print("\(passed) native protected-data tests passed")
