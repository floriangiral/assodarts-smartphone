//
//  AssodartsApp.swift
//  Assodarts
//

import SwiftUI

@main
struct AssodartsApp: App {
    @State private var store = AppStore()
    @State private var localization = Localization.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(store)
                .environment(localization)
                .environment(\.locale, localization.locale)
                .tint(Theme.navy)
                .id(localization.lang)
        }
    }
}
