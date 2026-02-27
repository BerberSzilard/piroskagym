-- CI seed: admin user

-- email: ci_admin@piroska.test

-- password: ci_password



INSERT INTO users (email, password_hash, name, role)

VALUES (

  'ci_admin@piroska.test',

  '$2a$10$TPpMghsHOxKEKDEdL8kMruR9z7ofrUwdXOIq.iu5e0t0ryQ55hMF.',

  'CI Admin',

  'admin'

)

ON CONFLICT (email) DO NOTHING;
