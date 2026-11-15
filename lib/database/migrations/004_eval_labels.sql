-- 004: hand labels for the extraction evaluation (N of M). Safe to rerun.
-- split is fixed from a hash of the listing id BEFORE anyone looks at results.
CREATE TABLE IF NOT EXISTS eval_labels (
  opportunity_id uuid NOT NULL REFERENCES opportunities(opportunity_id) ON DELETE CASCADE,
  field          text NOT NULL,
  verdict        text NOT NULL CHECK (verdict IN ('correct', 'wrong', 'missing', 'na')),
  note           text,
  labeled_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (opportunity_id, field)
);
