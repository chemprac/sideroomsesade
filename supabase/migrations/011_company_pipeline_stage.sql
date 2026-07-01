-- Company-level pipeline stage, separate from outreach_companies.stage (funding stage — do not touch).
-- Tracks deal progress per account, aggregated from outreach_leads.

ALTER TABLE public.outreach_companies
  ADD COLUMN pipeline_stage text NOT NULL DEFAULT 'not_started'
  CHECK (pipeline_stage IN (
    'not_started',
    'outreach_started',
    'reply_received',
    'call_booked',
    'trialled',
    'pilot_negotiation',
    'closed_won',
    'closed_lost'
  ));

ALTER TABLE public.outreach_companies
  ADD COLUMN pipeline_stage_updated_at timestamptz DEFAULT now();

ALTER TABLE public.outreach_companies
  ADD COLUMN pipeline_notes text;

-- Primary contact driving the deal at this company.
ALTER TABLE public.outreach_companies
  ADD COLUMN champion_lead_id uuid REFERENCES public.outreach_leads(id) ON DELETE SET NULL;

-- Backfill from real outreach_leads.stage enum (sourced/contacted/engaged/replied/qualified/closed_lost/dormant) —
-- there is no "connection_sent"/"pitch_sent" style enum in this schema, only the four-stage funnel plus terminals.
UPDATE public.outreach_companies oc
SET pipeline_stage = 'reply_received',
    pipeline_stage_updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM public.outreach_leads ol
  WHERE ol.company_id = oc.id
  AND ol.replied_at IS NOT NULL
);

UPDATE public.outreach_companies oc
SET pipeline_stage = 'outreach_started',
    pipeline_stage_updated_at = now()
WHERE pipeline_stage = 'not_started'
AND EXISTS (
  SELECT 1 FROM public.outreach_leads ol
  WHERE ol.company_id = oc.id
  AND (ol.stage <> 'sourced' OR ol.connection_accepted_at IS NOT NULL)
);

-- Auto-advance is intentionally limited to the two states with a real per-lead signal.
-- call_booked, trialled, pilot_negotiation, closed_won, closed_lost are manual-only (dragged in the UI) —
-- there is no lead-level "call booked" or deal-stage equivalent to trigger off.
CREATE OR REPLACE FUNCTION sync_company_pipeline_stage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.replied_at IS NOT NULL AND OLD.replied_at IS NULL THEN
    UPDATE public.outreach_companies
    SET pipeline_stage = 'reply_received',
        pipeline_stage_updated_at = now()
    WHERE id = NEW.company_id
    AND pipeline_stage IN ('not_started', 'outreach_started');
  END IF;

  IF NEW.stage <> 'sourced' AND OLD.stage = 'sourced' THEN
    UPDATE public.outreach_companies
    SET pipeline_stage = 'outreach_started',
        pipeline_stage_updated_at = now()
    WHERE id = NEW.company_id
    AND pipeline_stage = 'not_started';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_company_pipeline_stage ON public.outreach_leads;

CREATE TRIGGER trg_sync_company_pipeline_stage
  AFTER UPDATE ON public.outreach_leads
  FOR EACH ROW
  WHEN (NEW.company_id IS NOT NULL)
  EXECUTE FUNCTION sync_company_pipeline_stage();
