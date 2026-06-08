
CREATE OR REPLACE FUNCTION public.notify_introduction_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  requester_name text;
BEGIN
  SELECT COALESCE(NULLIF(first_name, ''), 'A neighbor') INTO requester_name
  FROM public.resident_profiles WHERE id = NEW.requester_id;
  INSERT INTO public.notifications (building_id, recipient_id, message)
  VALUES (NEW.building_id, NEW.recipient_id,
    '🤝 ' || requester_name || ' would like an introduction');
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notify_introduction_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recipient_name text;
  msg text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT COALESCE(NULLIF(first_name, ''), 'A neighbor') INTO recipient_name
  FROM public.resident_profiles WHERE id = NEW.recipient_id;
  IF NEW.status = 'accepted' THEN
    msg := '✨ ' || recipient_name || ' accepted your introduction';
  ELSIF NEW.status = 'declined' THEN
    msg := recipient_name || ' is not available to connect right now';
  ELSE
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (building_id, recipient_id, message)
  VALUES (NEW.building_id, NEW.requester_id, msg);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_introduction_request_notify ON public.resident_introductions;
CREATE TRIGGER trg_introduction_request_notify
AFTER INSERT ON public.resident_introductions
FOR EACH ROW EXECUTE FUNCTION public.notify_introduction_request();

DROP TRIGGER IF EXISTS trg_introduction_response_notify ON public.resident_introductions;
CREATE TRIGGER trg_introduction_response_notify
AFTER UPDATE ON public.resident_introductions
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.notify_introduction_response();
