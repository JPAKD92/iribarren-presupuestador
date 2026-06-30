-- Tabla de presupuestos de Iribarren Tornería
CREATE TABLE IF NOT EXISTS presupuestos_iribarren (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  numero      text NOT NULL,
  fecha       date NOT NULL DEFAULT CURRENT_DATE,
  cliente     text DEFAULT '',
  trabajo     text DEFAULT '',
  total       text DEFAULT '',
  observaciones text DEFAULT '',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Acceso público (sin autenticación)
ALTER TABLE presupuestos_iribarren ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON presupuestos_iribarren
  FOR ALL USING (true) WITH CHECK (true);
