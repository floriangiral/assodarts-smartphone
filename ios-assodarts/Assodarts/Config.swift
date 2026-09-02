// Config.swift
// Firebase client configuration, selected at compile time by the active
// build configuration (Debug -> STAGING, Release -> PRODUCTION; see
// SWIFT_ACTIVE_COMPILATION_CONDITIONS in project.pbxproj).
//
// These are public client identifiers (API key, project/app/sender IDs),
// not secrets: Firebase access control comes from Firestore Security Rules
// and API key restrictions in Google Cloud, not from hiding these values.

import Foundation

enum Config {
    #if PRODUCTION
    static let FIREBASE_API_KEY = ""
    static let FIREBASE_APP_ID = ""
    static let FIREBASE_PROJECT_ID = "assodarts"
    static let FIREBASE_GCM_SENDER_ID = "421200763226"
    static let FIREBASE_STORAGE_BUCKET = ""
    #else
    static let FIREBASE_API_KEY = "AIzaSyA9Ytv-16YCsaUaBTfLf5qgpZzksg8mZuQ"
    static let FIREBASE_APP_ID = "1:189674137376:ios:cfda13b59775fba891d945"
    static let FIREBASE_PROJECT_ID = "assodarts-staging"
    static let FIREBASE_GCM_SENDER_ID = "189674137376"
    static let FIREBASE_STORAGE_BUCKET = ""
    #endif

    static let allValues: [String: String] = [
        "FIREBASE_API_KEY": FIREBASE_API_KEY,
        "FIREBASE_APP_ID": FIREBASE_APP_ID,
        "FIREBASE_PROJECT_ID": FIREBASE_PROJECT_ID,
        "FIREBASE_GCM_SENDER_ID": FIREBASE_GCM_SENDER_ID,
        "FIREBASE_STORAGE_BUCKET": FIREBASE_STORAGE_BUCKET,
    ]
}

