## Problem

Sign-up fails with: `column "privacy_level" is of type privacy_level but expression is of type text`.

The `join_building_as_resident` RPC accepts `_privacy_level` as `text` and inserts it directly into `resident_profiles.privacy_level`, which is a Postgres enum (`public.privacy_level`). Postgres won't implicitly cast text → enum, so the insert throws.

## Fix

Ship a small migration that replaces the RPC body so the value is cast to the enum, and validates it:

```sql
INSERT INTO public.resident_profiles (
  ..., privacy_level, ...
) VALUES (
  ..., coalesce(_privacy_level, 'public')::public.privacy_level, ...
);
```

Signature stays the same (`_privacy_level text`) so the client call and generated types don't change. Invalid values will raise a clean enum error instead of the current confusing message.

No frontend changes needed.