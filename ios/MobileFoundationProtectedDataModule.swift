import ExpoModulesCore
import UIKit

public final class MobileFoundationProtectedDataModule: Module {
  private let availability = ProtectedDataAvailability(
    isAvailable: { UIApplication.shared.isProtectedDataAvailable },
    notificationName: UIApplication.protectedDataDidBecomeAvailableNotification
  )

  public func definition() -> ModuleDefinition {
    Name("MobileFoundationProtectedData")

    AsyncFunction("getAvailabilityAsync") { () -> Bool in
      self.availability.snapshot()
    }.runOnQueue(.main)

    AsyncFunction("waitForAvailabilityAsync") { (id: String, promise: Promise) in
      self.availability.wait(id: id) { result in
        switch result {
        case .success: promise.resolve()
        case .failure: promise.reject("ERR_PROTECTED_DATA_WAIT_CANCELLED", "Protected-data wait was cancelled")
        }
      }
    }.runOnQueue(.main)

    AsyncFunction("cancelWaitAsync") { (id: String) in
      self.availability.cancel(id: id)
    }.runOnQueue(.main)

    OnDestroy {
      DispatchQueue.main.async { self.availability.cancelAll() }
    }
  }
}
