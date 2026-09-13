require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name             = 'MobileFoundationDiagnostics'
  s.version          = package['version']
  s.summary          = 'Native diagnostics for mobile-foundation-rn'
  s.description      = package['description']
  s.license          = package['license']
  s.author           = 'Zyno Consulting'
  s.homepage         = 'https://github.com/zyno-io/mobile-foundation-rn'
  s.platforms        = { :ios => '15.1' }
  s.swift_version    = '5.4'
  s.source           = { :git => 'https://github.com/zyno-io/mobile-foundation-rn.git', :tag => s.version.to_s }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.libraries = 'sqlite3'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
