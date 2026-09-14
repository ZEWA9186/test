CREATE TABLE IF NOT EXISTS code_entity (
                                           id SERIAL PRIMARY KEY,
                                           code VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT UQ_code_entity_code UNIQUE (code)
    );

CREATE INDEX IF NOT EXISTS IDX_code_entity_code ON code_entity(code);

CREATE TABLE IF NOT EXISTS trial_entity (
                                            id SERIAL PRIMARY KEY,
                                            line_ip VARCHAR(255) NOT NULL,
                                            remaining_minutes INTEGER NOT NULL DEFAULT 86400,
                                            is_trial BOOLEAN NOT NULL DEFAULT TRUE,
                                            CONSTRAINT UQ_trial_entity_line_ip UNIQUE (line_ip)
    );