-- Custom SQL migration file, put your code below! --

-- Bump nominations.last_activity_at whenever a vote, prediction, or
-- contribution is inserted. (Hub messages are deferred for v2.)

CREATE OR REPLACE FUNCTION update_nomination_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE nominations
  SET last_activity_at = now()
  WHERE id = NEW.nomination_id;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER trg_vote_activity
  AFTER INSERT ON votes
  FOR EACH ROW EXECUTE FUNCTION update_nomination_activity();
--> statement-breakpoint
CREATE TRIGGER trg_prediction_activity
  AFTER INSERT ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_nomination_activity();
--> statement-breakpoint
CREATE TRIGGER trg_contribution_activity
  AFTER INSERT ON contributions
  FOR EACH ROW EXECUTE FUNCTION update_nomination_activity();
