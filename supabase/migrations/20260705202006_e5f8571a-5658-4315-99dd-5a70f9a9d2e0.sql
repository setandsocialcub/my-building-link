
CREATE TABLE IF NOT EXISTS public.building_legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN (
    'privacy','terms','pool-rules','pet-policy','parking-rules',
    'community-rules','emergency-procedures','move-in-guide','house-rules'
  )),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS building_legal_current_per_type
  ON public.building_legal_documents (building_id, doc_type)
  WHERE is_current;

CREATE INDEX IF NOT EXISTS building_legal_by_building
  ON public.building_legal_documents (building_id, doc_type, version DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.building_legal_documents TO authenticated;
GRANT ALL ON public.building_legal_documents TO service_role;

ALTER TABLE public.building_legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Building members can read legal documents"
  ON public.building_legal_documents FOR SELECT
  TO authenticated
  USING (public.has_building_access(building_id));

CREATE POLICY "Managers and admins can insert legal documents"
  ON public.building_legal_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_manager_of_building(building_id)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Managers and admins can update legal documents"
  ON public.building_legal_documents FOR UPDATE
  TO authenticated
  USING (
    public.is_manager_of_building(building_id)
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.is_manager_of_building(building_id)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Managers and admins can delete legal documents"
  ON public.building_legal_documents FOR DELETE
  TO authenticated
  USING (
    public.is_manager_of_building(building_id)
    OR public.has_role(auth.uid(), 'admin')
  );

DROP TRIGGER IF EXISTS building_legal_documents_set_updated_at ON public.building_legal_documents;
CREATE TRIGGER building_legal_documents_set_updated_at
  BEFORE UPDATE ON public.building_legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
