# Assodarts Cloud Functions

## Transactional email secrets

The `sendMailOnCreate` function sends documents from the `mail` collection through Resend. Configure the Firebase Functions v2 secrets once per Firebase project; never commit their values.

### Staging

```sh
firebase use assodarts-staging
firebase functions:secrets:set RESEND_API_KEY
firebase functions:secrets:set DEFAULT_FROM_EMAIL
```

For staging, set `DEFAULT_FROM_EMAIL` to the verified Resend sender `ne_pas_repondre@assodarts.app`. The `assodarts.app` domain must be verified in the Resend dashboard before sending.

### Production

Select the production Firebase project, then set the same secrets:

```sh
firebase use <production-project-id>
firebase functions:secrets:set RESEND_API_KEY
firebase functions:secrets:set DEFAULT_FROM_EMAIL
```

Use the verified `assodarts.app` sender for `DEFAULT_FROM_EMAIL` in production as well. Deploy the Functions after configuring the secrets so the trigger receives access to them.
