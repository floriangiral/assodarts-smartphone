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
                transferNote: tr(
                    "Merci d'indiquer la référence de l'appel à paiement dans le libellé du virement.",
                    "Please quote the payment request reference in your transfer label."
                ),
                cashNote: tr(
                    "Remise possible au club house les mardis et jeudis soir, auprès du trésorier.",
                    "Cash accepted at the club house on Tuesday and Thursday evenings, from the treasurer."
                ),
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
                title: tr("Reprise des entraînements", "Training is back"),
                body: tr(
                    "Les entraînements reprennent tous les mardis et jeudis à 19h au club house. "
                        + "Pensez à ramener vos fléchettes personnelles, les jeux du club restent disponibles pour les nouveaux.",
                    "Training resumes every Tuesday and Thursday at 7pm at the club house. "
                        + "Bring your own darts — the club sets stay available for newcomers."
                ),
                authorId: julien.id,
                publishedAt: day(-2),
                isPinned: true
            ),
            Announcement(
                clubId: lyon.id,
                title: tr("Licences 2026–2027 : dernière ligne droite", "2026–2027 licences: final stretch"),
                body: tr(
                    "Le bureau boucle les dossiers de licence cette semaine. "
                        + "Si votre numéro n'apparaît pas encore sur votre profil, écrivez au bureau depuis la messagerie.",
                    "The committee is closing licence files this week. "
                        + "If your number is not on your profile yet, message the committee from the app."
                ),
                authorId: karim.id,
                publishedAt: day(-6)
            ),
            Announcement(
                clubId: lyon.id,
                title: tr("Nouvelles tenues du club", "New club kit"),
                body: tr(
                    "Les maillots floqués sont arrivés. Un appel à paiement de 62 € a été envoyé aux membres concernés, "
                        + "retrait au club house les soirs d'entraînement.",
                    "The printed shirts have arrived. A €62 payment request was sent to the members concerned; "
                        + "collect yours at the club house on training nights."
                ),
                authorId: karim.id,
                publishedAt: day(-11)
            ),
            Announcement(
                clubId: lyon.id,
                title: tr("Assemblée générale le 12 décembre", "General meeting on 12 December"),
                body: tr(
                    "Convocation officielle à l'assemblée générale ordinaire. Ordre du jour : bilan sportif, "
                        + "bilan financier, renouvellement du tiers sortant du bureau.",
                    "Official notice for the annual general meeting. Agenda: season review, "
                        + "financial report, and election of the outgoing third of the committee."
                ),
                authorId: julien.id,
                publishedAt: day(-19)
            )
        ]

        // MARK: Events

        db.events = [
            ClubEvent(
                clubId: lyon.id,
                title: tr("Entraînement hebdomadaire", "Weekly training"),
                kind: .entrainement,
                date: day(2),
                location: "Club house · Lyon 7e",
                details: tr(
                    "Séance ouverte à tous, travail des doubles et série de 501.",
                    "Open session for everyone: doubles practice and a 501 series."
                ),
                attendeeIds: [julien.id, karim.id, nadia.id]
            ),
            ClubEvent(
                clubId: lyon.id,
                title: "Open de Villeurbanne",
                kind: .competition,
                date: day(9),
                location: "Salle des sports · Villeurbanne",
                details: tr(
                    "Départ groupé du club house à 8h30. Déplacement facturé 33 € par joueur.",
                    "Group departure from the club house at 8:30am. Travel billed at €33 per player."
                ),
                attendeeIds: [sophie.id, karim.id]
            ),
            ClubEvent(
                clubId: lyon.id,
                title: tr("Réunion du bureau", "Committee meeting"),
                kind: .reunion,
                date: day(14),
                location: tr("Club house · salle du haut", "Club house · upstairs room"),
                details: tr(
                    "Point licences, budget tenues et préparation de l'assemblée générale.",
                    "Licence update, kit budget and preparation of the general meeting."
                ),
                attendeeIds: [julien.id, karim.id]
            ),
            ClubEvent(
                clubId: lyon.id,
                title: tr("Soirée de rentrée du club", "Club season opening night"),
                kind: .convivial,
                date: day(21),
                location: "Club house · Lyon 7e",
                details: tr(
                    "Buffet partagé et tournoi amical en doublettes tirées au sort.",
                    "Shared buffet and a friendly tournament in randomly drawn pairs."
                ),
                attendeeIds: [sophie.id, nadia.id, julien.id]
            ),
            ClubEvent(
                clubId: lyon.id,
                title: tr("Interclubs · journée 1", "Interclub · round 1"),
                kind: .competition,
                date: day(-8),
                location: "Saint-Priest",
                details: tr("Victoire 5-3 face à Saint-Priest.", "5-3 win against Saint-Priest."),
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
                tableau: tr("Tableau principal", "Main draw"),
                tour: tr("Poule A", "Group A"),
                playerA: "Sophie Laurent",
                playerB: "Marion Dubois",
                scoreA: 3,
                scoreB: 1,
                note: tr("Sortie sur double 16.", "Checkout on double 16."),
                recordedById: karim.id,
                recordedAt: day(-1)
            ),
            TournamentEntry(
                tableau: tr("Tableau principal", "Main draw"),
                tour: tr("Poule A", "Group A"),
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
            name: tr("Interclubs Rhône · journée 1", "Rhône interclub · round 1"),
            date: day(-8),
            location: "Saint-Priest",
            markerIds: [karim.id, julien.id],
            isFinished: true
        )
        interclubs.entries = [
            TournamentEntry(
                tableau: tr("Rencontre par équipes", "Team fixture"),
                tour: tr("Simples 1", "Singles 1"),
                playerA: "Julien Morel",
                playerB: "Franck Ledoux",
                scoreA: 3,
                scoreB: 0,
                note: tr("Moyenne 68,1.", "68.1 average."),
                recordedById: julien.id,
                recordedAt: day(-8)
            ),
            TournamentEntry(
                tableau: tr("Rencontre par équipes", "Team fixture"),
                tour: tr("Doublettes", "Doubles"),
                playerA: "Sophie Laurent / Karim Benali",
                playerB: tr("Équipe Saint-Priest 2", "Saint-Priest team 2"),
                scoreA: 2,
                scoreB: 3,
                note: tr(
                    "Match très serré, décidé au dernier leg.",
                    "Very tight match, decided on the last leg."
                ),
                recordedById: karim.id,
                recordedAt: day(-8)
            )
        ]
        db.tournaments = [open, interclubs]

        // MARK: Payment calls

        let allLyonIds = ([julien, karim, sophie, nadia] + extras).map(\.id)

        var cotisation = PaymentCall(
            clubId: lyon.id,
            label: tr("Cotisation 2026–2027", "Membership fee 2026–2027"),
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
            label: tr("Tenue du club 2026", "Club kit 2026"),
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
            label: tr("Déplacement Open de Villeurbanne", "Travel — Villeurbanne Open"),
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
            deplacement.items[sophieIndex].reference = tr(
                "Remis à Karim Benali au club house",
                "Handed to Karim Benali at the club house"
            )
        }

        var previousSeason = PaymentCall(
            clubId: lyon.id,
            label: tr("Cotisation 2025–2026", "Membership fee 2025–2026"),
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
                    text: tr(
                        "Bonjour Sophie, ta licence 2026–2027 est validée par le club ✅",
                        "Hi Sophie, your 2026–2027 licence has been approved by the club ✅"
                    ),
                    sentAt: hour(-5),
                    readBy: [karim.id]
                ),
                Message(
                    senderId: karim.id,
                    text: tr(
                        "Tu peux passer récupérer ta carte de membre au club house.",
                        "You can pick up your membership card at the club house."
                    ),
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
                    text: tr(
                        "Tu peux passer récupérer les tee-shirts avant samedi ?",
                        "Could you pick up the shirts before Saturday?"
                    ),
                    sentAt: day(-1),
                    readBy: [julien.id, sophie.id]
                ),
                Message(
                    senderId: sophie.id,
                    text: tr(
                        "Oui sans souci, je passe jeudi soir après l'entraînement.",
                        "Sure, I'll come by Thursday evening after training."
                    ),
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
                    text: tr(
                        "Bonjour, est-ce que je peux régler la cotisation en deux fois ?",
                        "Hello, can I pay the membership fee in two instalments?"
                    ),
                    sentAt: day(-2),
                    readBy: [nadia.id]
                ),
                Message(
                    senderId: karim.id,
                    text: tr(
                        "Merci pour le retour, on voit ça en réunion de bureau mardi.",
                        "Thanks for asking — we'll discuss it at Tuesday's committee meeting."
                    ),
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
                    text: tr(
                        "Bonjour, je souhaiterais m'inscrire au déplacement de Villeurbanne.",
                        "Hello, I'd like to sign up for the trip to Villeurbanne."
                    ),
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
                title: tr("Nouveauté : paiements dans l'application", "New: in-app payments"),
                body: tr(
                    "Les membres peuvent désormais régler leurs cotisations, tenues et déplacements "
                        + "directement depuis l'application. Le bureau suit les encaissements en temps réel.",
                    "Members can now pay their fees, kit and travel directly in the app. "
                        + "The committee tracks collections in real time."
                ),
                audience: .all,
                publishedAt: day(-3)
            ),
            PlatformAnnouncement(
                title: tr("Maintenance planifiée", "Scheduled maintenance"),
                body: tr(
                    "L'application sera indisponible dimanche de 2h à 4h pour une mise à jour serveur. "
                        + "Aucune action n'est requise de votre côté.",
                    "The app will be unavailable on Sunday from 2am to 4am for a server update. "
                        + "No action is needed on your side."
                ),
                audience: .admins,
                publishedAt: day(-9)
            ),
            PlatformAnnouncement(
                title: tr("Bienvenue sur Assodarts", "Welcome to Assodarts"),
                body: tr(
                    "La plateforme s'ouvre aux premiers clubs de la fédération. Merci de votre confiance !",
                    "The platform is opening to the federation's first clubs. Thank you for your trust!"
                ),
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
