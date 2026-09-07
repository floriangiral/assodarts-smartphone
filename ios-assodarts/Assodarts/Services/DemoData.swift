import Foundation

/// Seeds the app with a realistic French demo platform: one fully detailed club
/// (Fléchettes Club de Lyon) plus the wider platform used by the developer console.
enum DemoData {
    static func day(_ offset: Int) -> Date {
        Calendar.current.date(byAdding: .day, value: offset, to: .now) ?? .now
    }

    static func hour(_ offset: Int) -> Date {
        Calendar.current.date(byAdding: .hour, value: offset, to: .now) ?? .now
    }

    // MARK: - Seed

    static func seed() -> Database {
        var db = Database()

        let lyon = Club(
            id: UUID(),
            name: "Fléchettes Club de Lyon",
            city: "Lyon",
            createdAt: day(-1080),
            renewalDate: day(120),
            status: .active,
            seedMemberCount: 24,
            couponCode: "CLUB25"
        )
        let marseille = Club(
            id: UUID(),
            name: "Darts Club de Marseille",
            city: "Marseille",
            createdAt: day(-210),
            renewalDate: day(155),
            status: .active,
            seedMemberCount: 61,
            couponCode: "LANC2026"
        )
        let rennes = Club(
            id: UUID(),
            name: "Fléchettes Rennais",
            city: "Rennes",
            createdAt: day(-24),
            renewalDate: day(341),
            status: .trial,
            seedMemberCount: 12,
            couponCode: nil
        )
        let devClub = Club(
            id: UUID(),
            name: "Assodarts",
            city: "Plateforme",
            createdAt: day(-1200),
            renewalDate: day(365),
            status: .active,
            seedMemberCount: 1,
            couponCode: nil
        )

        db.clubs = [lyon, marseille, rennes, devClub] + syntheticClubs()

        // Bank details of the demo club: online collection verified, plus bank
        // transfer and cash accepted with bureau validation.
        if let lyonIndex = db.clubs.firstIndex(where: { $0.id == lyon.id }) {
            db.clubs[lyonIndex].bank = ClubBankAccount(
                holder: "Fléchettes Club de Lyon",
                iban: "FR76 3000 6000 0112 3456 7890 189",
                bic: "AGRIFRPP",
                bankName: "Crédit Agricole",
                stripeStatus: .verified,
                stripeAccountId: "acct_demolyonclub01",
                acceptsTransfer: true,
                acceptsCash: true,
                transferNote: tr("please_quote_the_payment_request_reference_in_your_trans"),
                cashNote: tr("cash_accepted_at_the_club_house_on_tuesday_and_thursday_"),
                updatedAt: day(-30)
            )
        }

        // MARK: Members of the demo club

        let julien = Member(
            clubId: lyon.id,
            firstName: "Julien",
            lastName: "Morel",
            email: "admin@fcl-lyon.fr",
            phone: "06 11 45 88 21",
            birthDate: day(-15_600),
            role: .admin,
            isLicensed: true,
            licenceNumber: "07 84 220 145",
            joinedAt: day(-1075),
            eventsAttended: 22,
            tournamentsPlayed: 9,
            average: 64.8
        )
        let karim = Member(
            clubId: lyon.id,
            firstName: "Karim",
            lastName: "Benali",
            email: "bureau@fcl-lyon.fr",
            phone: "06 78 20 44 10",
            birthDate: day(-13_100),
            role: .bureau,
            isLicensed: true,
            licenceNumber: "07 84 907 118",
            joinedAt: day(-590),
            eventsAttended: 17,
            tournamentsPlayed: 7,
            average: 58.2
        )
        let sophie = Member(
            clubId: lyon.id,
            firstName: "Sophie",
            lastName: "Laurent",
            email: "sophie@fcl-lyon.fr",
            phone: "06 42 18 77 05",
            birthDate: day(-12_890),
            role: .membre,
            isLicensed: true,
            licenceNumber: "07 84 512 336",
            joinedAt: day(-1080),
            notifyTournaments: false,
            eventsAttended: 14,
            tournamentsPlayed: 6,
            average: 61.4
        )
        let nadia = Member(
            clubId: lyon.id,
            firstName: "Nadia",
            lastName: "Petit",
            email: "nadia.petit@fcl-lyon.fr",
            phone: "06 33 91 02 77",
            role: .membre,
            isLicensed: false,
            joinedAt: day(-300),
            eventsAttended: 8,
            tournamentsPlayed: 2,
            average: 47.6
        )
        let developer = Member(
            clubId: devClub.id,
            firstName: "Thomas",
            lastName: "Riva",
            email: "dev@assodarts.fr",
            phone: "06 09 55 12 33",
            role: .developpeur,
            joinedAt: day(-1200)
        )

        let extras = extraMembers(clubId: lyon.id)
        db.members = [julien, karim, sophie, nadia, developer] + extras

        // MARK: Announcements

        db.announcements = [
            Announcement(
                clubId: lyon.id,
                title: tr("training_is_back"),
                body: tr("training_resumes_every_tuesday_and_thursday_at_7pm_at_th"),
                authorId: julien.id,
                publishedAt: day(-2),
                isPinned: true
            ),
            Announcement(
                clubId: lyon.id,
                title: tr("20262027_licences_final_stretch"),
                body: tr("the_committee_is_closing_licence_files_this_week_if_your"),
                authorId: karim.id,
                publishedAt: day(-6)
            ),
            Announcement(
                clubId: lyon.id,
                title: tr("new_club_kit"),
                body: tr("the_printed_shirts_have_arrived_a_62_payment_request_was"),
                authorId: karim.id,
                publishedAt: day(-11)
            ),
            Announcement(
                clubId: lyon.id,
                title: tr("general_meeting_on_12_december"),
                body: tr("official_notice_for_the_annual_general_meeting_agenda_se"),
                authorId: julien.id,
                publishedAt: day(-19)
            )
        ]

        // MARK: Events

        db.events = [
            ClubEvent(
                clubId: lyon.id,
                title: tr("weekly_training"),
                kind: .entrainement,
                date: day(2),
                location: "Club house · Lyon 7e",
                details: tr("open_session_for_everyone_doubles_practice_and_a_501_ser"),
                attendeeIds: [julien.id, karim.id, nadia.id]
            ),
            ClubEvent(
                clubId: lyon.id,
                title: "Open de Villeurbanne",
                kind: .competition,
                date: day(9),
                location: "Salle des sports · Villeurbanne",
                details: tr("group_departure_from_the_club_house_at_8_30am_travel_bil"),
                attendeeIds: [sophie.id, karim.id]
            ),
            ClubEvent(
                clubId: lyon.id,
                title: tr("committee_meeting"),
                kind: .reunion,
                date: day(14),
                location: tr("club_house_upstairs_room"),
                details: tr("licence_update_kit_budget_and_preparation_of_the_general"),
                attendeeIds: [julien.id, karim.id]
            ),
            ClubEvent(
                clubId: lyon.id,
                title: tr("club_season_opening_night"),
                kind: .convivial,
                date: day(21),
                location: "Club house · Lyon 7e",
                details: tr("shared_buffet_and_a_friendly_tournament_in_randomly_draw"),
                attendeeIds: [sophie.id, nadia.id, julien.id]
            ),
            ClubEvent(
                clubId: lyon.id,
                title: tr("interclub_round_1"),
                kind: .competition,
                date: day(-8),
                location: "Saint-Priest",
                details: tr("5_3_win_against_saint_priest"),
                attendeeIds: [sophie.id, karim.id, julien.id]
            )
        ]

        // MARK: Tournaments

        var open = Tournament(
            clubId: lyon.id,
            name: "Open de Villeurbanne",
            date: day(9),
            location: "Salle des sports · Villeurbanne",
            markerIds: [karim.id]
        )
        open.entries = [
            TournamentEntry(
                tableau: tr("main_draw"),
                tour: tr("group_a"),
                playerA: "Sophie Laurent",
                playerB: "Marion Dubois",
                scoreA: 3,
                scoreB: 1,
                note: tr("checkout_on_double_16"),
                recordedById: karim.id,
                recordedAt: day(-1)
            ),
            TournamentEntry(
                tableau: tr("main_draw"),
                tour: tr("group_a"),
                playerA: "Karim Benali",
                playerB: "Yanis Rocher",
                scoreA: 2,
                scoreB: 3,
                note: "",
                recordedById: karim.id,
                recordedAt: day(-1)
            )
        ]

        var interclubs = Tournament(
            clubId: lyon.id,
            name: tr("rhone_interclub_round_1"),
            date: day(-8),
            location: "Saint-Priest",
            markerIds: [karim.id, julien.id],
            isFinished: true
        )
        interclubs.entries = [
            TournamentEntry(
                tableau: tr("team_fixture"),
                tour: tr("singles_1"),
                playerA: "Julien Morel",
                playerB: "Franck Ledoux",
                scoreA: 3,
                scoreB: 0,
                note: tr("68_1_average"),
                recordedById: julien.id,
                recordedAt: day(-8)
            ),
            TournamentEntry(
                tableau: tr("team_fixture"),
                tour: tr("doubles"),
                playerA: "Sophie Laurent / Karim Benali",
                playerB: tr("saint_priest_team_2"),
                scoreA: 2,
                scoreB: 3,
                note: tr("very_tight_match_decided_on_the_last_leg"),
                recordedById: karim.id,
                recordedAt: day(-8)
            )
        ]
        db.tournaments = [open, interclubs]

        // MARK: Payment calls

        let allLyonIds = ([julien, karim, sophie, nadia] + extras).map(\.id)

        var cotisation = PaymentCall(
            clubId: lyon.id,
            label: tr("membership_fee_20262027"),
            category: .cotisation,
            amountCents: 4500,
            dueDate: day(45),
            createdAt: day(-12),
            createdById: karim.id,
            reference: "COT-2026-0147",
            items: allLyonIds.map { PaymentItem(memberId: $0) }
        )
        for index in cotisation.items.indices where index % 3 != 0 {
            cotisation.items[index].isPaid = true
            cotisation.items[index].paidAt = day(-Int.random(in: 1...10))
        }
        if let sophieIndex = cotisation.items.firstIndex(where: { $0.memberId == sophie.id }) {
            cotisation.items[sophieIndex].isPaid = false
            cotisation.items[sophieIndex].paidAt = nil
        }
        // A transfer declared by a member, waiting for the bureau to confirm it.
        if let nadiaIndex = cotisation.items.firstIndex(where: { $0.memberId == nadia.id }) {
            cotisation.items[nadiaIndex].isPaid = false
            cotisation.items[nadiaIndex].paidAt = nil
            cotisation.items[nadiaIndex].method = .transfer
            cotisation.items[nadiaIndex].declaredAt = day(-2)
            cotisation.items[nadiaIndex].reference = "VIR COT-2026-0147"
        }

        var tenue = PaymentCall(
            clubId: lyon.id,
            label: tr("club_kit_2026"),
            category: .tenue,
            amountCents: 6200,
            dueDate: day(90),
            createdAt: day(-20),
            createdById: karim.id,
            reference: "TEN-2026-0032",
            items: allLyonIds.prefix(12).map { PaymentItem(memberId: $0) }
        )
        for index in tenue.items.indices where index % 3 != 2 {
            tenue.items[index].isPaid = true
            tenue.items[index].paidAt = day(-Int.random(in: 2...14))
        }
        if let sophieIndex = tenue.items.firstIndex(where: { $0.memberId == sophie.id }) {
            tenue.items[sophieIndex].isPaid = true
            tenue.items[sophieIndex].paidAt = day(-5)
        }

        var deplacement = PaymentCall(
            clubId: lyon.id,
            label: tr("travel_villeurbanne_open"),
            category: .deplacement,
            amountCents: 3300,
            dueDate: day(-6),
            createdAt: day(-25),
            createdById: karim.id,
            reference: "DEP-2026-0088",
            items: [sophie, karim, julien, nadia].map { PaymentItem(memberId: $0.id) }
        )
        if let karimIndex = deplacement.items.firstIndex(where: { $0.memberId == karim.id }) {
            deplacement.items[karimIndex].isPaid = true
            deplacement.items[karimIndex].paidAt = day(-12)
        }
        if let julienIndex = deplacement.items.firstIndex(where: { $0.memberId == julien.id }) {
            deplacement.items[julienIndex].isPaid = true
            deplacement.items[julienIndex].paidAt = day(-14)
            deplacement.items[julienIndex].method = .card
        }
        // Cash handed over and declared, pending bureau validation.
        if let sophieIndex = deplacement.items.firstIndex(where: { $0.memberId == sophie.id }) {
            deplacement.items[sophieIndex].method = .cash
            deplacement.items[sophieIndex].declaredAt = day(-1)
            deplacement.items[sophieIndex].reference = tr("handed_to_karim_benali_at_the_club_house")
        }

        var previousSeason = PaymentCall(
            clubId: lyon.id,
            label: tr("membership_fee_20252026"),
            category: .cotisation,
            amountCents: 4500,
            dueDate: day(-300),
            createdAt: day(-360),
            createdById: julien.id,
            reference: "COT-2025-0121",
            items: allLyonIds.map { PaymentItem(memberId: $0) }
        )
        for index in previousSeason.items.indices {
            previousSeason.items[index].isPaid = true
            previousSeason.items[index].paidAt = day(-310 + index)
        }

        db.paymentCalls = [cotisation, tenue, deplacement, previousSeason]

        // MARK: Conversations

        let bureauChannel = Conversation(
            clubId: lyon.id,
            kind: .bureau,
            participantIds: [sophie.id],
            messages: [
                Message(
                    senderId: karim.id,
                    text: tr("hi_sophie_your_20262027_licence_has_been_approved_by_the"),
                    sentAt: hour(-5),
                    readBy: [karim.id]
                ),
                Message(
                    senderId: karim.id,
                    text: tr("you_can_pick_up_your_membership_card_at_the_club_house"),
                    sentAt: hour(-4),
                    readBy: [karim.id]
                )
            ]
        )

        let withJulien = Conversation(
            clubId: lyon.id,
            kind: .direct,
            participantIds: [sophie.id, julien.id],
            messages: [
                Message(
                    senderId: julien.id,
                    text: tr("could_you_pick_up_the_shirts_before_saturday"),
                    sentAt: day(-1),
                    readBy: [julien.id, sophie.id]
                ),
                Message(
                    senderId: sophie.id,
                    text: tr("sure_i_ll_come_by_thursday_evening_after_training"),
                    sentAt: day(-1),
                    readBy: [julien.id, sophie.id]
                )
            ]
        )

        let karimAndNadia = Conversation(
            clubId: lyon.id,
            kind: .direct,
            participantIds: [karim.id, nadia.id],
            messages: [
                Message(
                    senderId: nadia.id,
                    text: tr("hello_can_i_pay_the_membership_fee_in_two_instalments"),
                    sentAt: day(-2),
                    readBy: [nadia.id]
                ),
                Message(
                    senderId: karim.id,
                    text: tr("thanks_for_asking_we_ll_discuss_it_at_tuesday_s_committe"),
                    sentAt: day(-1),
                    readBy: [karim.id, nadia.id]
                )
            ]
        )

        let nadiaChannel = Conversation(
            clubId: lyon.id,
            kind: .bureau,
            participantIds: [nadia.id],
            messages: [
                Message(
                    senderId: nadia.id,
                    text: tr("hello_i_d_like_to_sign_up_for_the_trip_to_villeurbanne"),
                    sentAt: day(-3),
                    readBy: [nadia.id]
                )
            ]
        )

        db.conversations = [bureauChannel, withJulien, karimAndNadia, nadiaChannel]

        // MARK: Coupons and platform announcements

        db.coupons = [
            Coupon(
                code: "CLUB25",
                percent: 25,
                expiresAt: day(300),
                clubIds: [lyon.id, rennes.id],
                autoRenew: true,
                createdAt: day(-60)
            ),
            Coupon(
                code: "LANC2026",
                percent: 100,
                expiresAt: day(180),
                clubIds: [marseille.id],
                autoRenew: false,
                createdAt: day(-120)
            )
        ]

        db.platformAnnouncements = [
            PlatformAnnouncement(
                title: tr("new_in_app_payments"),
                body: tr("members_can_now_pay_their_fees_kit_and_travel_directly_i"),
                audience: .all,
                publishedAt: day(-3)
            ),
            PlatformAnnouncement(
                title: tr("scheduled_maintenance"),
                body: tr("the_app_will_be_unavailable_on_sunday_from_2am_to_4am_fo"),
                audience: .admins,
                publishedAt: day(-9)
            ),
            PlatformAnnouncement(
                title: tr("welcome_to_assodarts"),
                body: tr("the_platform_is_opening_to_the_federation_s_first_clubs_"),
                audience: .all,
                publishedAt: day(-25)
            )
        ]

        return db
    }

    // MARK: - Helpers

    private static func extraMembers(clubId: UUID) -> [Member] {
        let people: [(String, String, Bool)] = [
            ("Marion", "Dubois", true),
            ("Yanis", "Rocher", true),
            ("Camille", "Girard", true),
            ("Hugo", "Lemaire", false),
            ("Inès", "Marchand", true),
            ("Paul", "Roussel", false),
            ("Élodie", "Chevalier", true),
            ("Mehdi", "Aziz", true),
            ("Laura", "Bonnet", false),
            ("Antoine", "Perrin", true),
            ("Sarah", "Meunier", true),
            ("Lucas", "Faure", false),
            ("Chloé", "Guerin", true),
            ("Damien", "Colin", true),
            ("Manon", "Lopez", false),
            ("Théo", "Blanc", true),
            ("Amandine", "Robin", true),
            ("Vincent", "Noel", false),
            ("Leïla", "Hamidi", true),
            ("Bastien", "Renard", true)
        ]
        return people.enumerated().map { index, person in
            Member(
                clubId: clubId,
                firstName: person.0,
                lastName: person.1,
                email: "\(person.0.lowercased()).\(person.1.lowercased())@fcl-lyon.fr",
                phone: "06 \(20 + index) \(10 + index) \(30 + index) \(40 + index)",
                role: .membre,
                isLicensed: person.2,
                licenceNumber: person.2 ? "07 84 \(600 + index * 7) \(100 + index)" : "",
                joinedAt: day(-200 - index * 21),
                eventsAttended: 4 + index % 14,
                tournamentsPlayed: index % 7,
                average: 38 + Double(index % 25) + 0.4
            )
        }
    }

    /// Additional tenants used to make the developer console reflect a real
    /// platform (47 clubs, ~1 280 members).
    private static func syntheticClubs() -> [Club] {
        let cities = [
            "Bordeaux", "Nantes", "Toulouse", "Lille", "Strasbourg", "Nice", "Montpellier",
            "Rouen", "Dijon", "Grenoble", "Angers", "Reims", "Le Mans", "Brest", "Tours",
            "Limoges", "Amiens", "Metz", "Perpignan", "Besançon", "Orléans", "Caen",
            "Nancy", "Avignon", "Poitiers", "Pau", "La Rochelle", "Annecy", "Troyes",
            "Valence", "Chambéry", "Quimper", "Colmar", "Vannes", "Lorient", "Béziers",
            "Niort", "Albi", "Roanne", "Vichy", "Chartres", "Blois", "Auxerre"
        ]
        return cities.enumerated().map { index, city in
            let count = [8, 14, 19, 23, 27, 31, 36, 42, 47, 55, 63, 74, 88, 104][index % 14]
            let status: SubscriptionStatus
            switch index % 9 {
            case 0: status = .trial
            case 7: status = .grace
            default: status = .active
            }
            return Club(
                id: UUID(),
                name: index % 2 == 0 ? "Fléchettes Club de \(city)" : "Darts Club de \(city)",
                city: city,
                createdAt: day(-30 - index * 17),
                renewalDate: day(365 - (index * 17) % 365),
                status: status,
                seedMemberCount: count,
                couponCode: nil
            )
        }
    }
}
