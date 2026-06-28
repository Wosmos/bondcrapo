-- Wallet: lets the wallet-notify job join new draw results to wallet bonds by
-- (denomination, number) without scanning wallet_bonds. Additive and safe on the live database.
CREATE INDEX IF NOT EXISTS "idx_wallet_bonds_lookup" ON "wallet_bonds" USING btree ("denomination_code","bond_number");
