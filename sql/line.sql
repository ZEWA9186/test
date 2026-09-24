    INSERT INTO trial_entity (line_ip, remaining_minutes, is_trial)
    VALUES
        ('172.16.16.40', 15000, TRUE),
        ('172.16.16.30', NULL, FALSE),
        ('172.16.16.20', NULL, FALSE),
        ('172.16.16.10', NULL, FALSE)
        ON CONFLICT (line_ip) DO UPDATE SET
        remaining_minutes = EXCLUDED.remaining_minutes,
                                    is_trial = EXCLUDED.is_trial;