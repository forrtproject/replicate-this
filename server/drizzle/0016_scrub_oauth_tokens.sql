-- Custom SQL migration file, put your code below! --

-- Clear the OAuth tokens Better Auth stored on account rows created before the
-- sign-in hooks started discarding them. A Google `id_token` is a JWT holding
-- the real name and email; nothing in the app calls a provider after sign-in.
UPDATE "account"
SET "access_token" = NULL,
    "refresh_token" = NULL,
    "id_token" = NULL
WHERE "access_token" IS NOT NULL
   OR "refresh_token" IS NOT NULL
   OR "id_token" IS NOT NULL;
