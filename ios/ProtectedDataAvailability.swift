import Foundation

/// UIKit supplies the availability query and notification in the Expo module.
/// Keeping the coordinator independent of UIKit permits deterministic race tests.
final class ProtectedDataAvailability {
  enum WaitError: Error { case cancelled }

  private let isAvailable: () -> Bool
  private let notifications: NotificationCenter
  private let notificationName: Notification.Name
  private var observer: NSObjectProtocol?
  private var waiters: [String: (Result<Void, WaitError>) -> Void] = [:]

  init(isAvailable: @escaping () -> Bool, notificationName: Notification.Name, notifications: NotificationCenter = .default) {
    self.isAvailable = isAvailable
    self.notificationName = notificationName
    self.notifications = notifications
  }

  func snapshot() -> Bool {
    precondition(Thread.isMainThread)
    return isAvailable()
  }

  func wait(id: String, completion: @escaping (Result<Void, WaitError>) -> Void) {
    precondition(Thread.isMainThread)
    if isAvailable() { completion(.success(())); return }
    waiters[id] = completion
    if observer == nil {
      observer = notifications.addObserver(forName: notificationName, object: nil, queue: .main) { [weak self] _ in
        self?.resolveIfAvailable()
      }
    }
    // Unlock can precede observer registration. Notification delivery is a
    // retry signal; the query must still confirm availability.
    resolveIfAvailable()
  }

  func cancel(id: String) {
    precondition(Thread.isMainThread)
    let completion = waiters.removeValue(forKey: id)
    removeObserverIfIdle()
    completion?(.failure(.cancelled))
  }

  func cancelAll() {
    precondition(Thread.isMainThread)
    let pending = waiters
    waiters.removeAll()
    removeObserverIfIdle()
    pending.values.forEach { $0(.failure(.cancelled)) }
  }

  private func resolveIfAvailable() {
    guard isAvailable() else { return }
    let pending = waiters
    waiters.removeAll()
    removeObserverIfIdle()
    pending.values.forEach { $0(.success(())) }
  }

  private func removeObserverIfIdle() {
    if waiters.isEmpty, let observer {
      notifications.removeObserver(observer)
      self.observer = nil
    }
  }
}
