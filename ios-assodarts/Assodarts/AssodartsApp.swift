//
//  AssodartsApp.swift
//  Assodarts
//

import SwiftUI

@main
struct AssodartsApp: App {
    @State private var store = AppStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(store)
                .environment(\.locale, Locale(identifier: "fr_FR"))
                .tint(Theme.navy)
        }
    }
}
