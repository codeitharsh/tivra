-- ════════════════════════════════════════════════════════════════
-- TIVRA — Final program content + fixed feature-grid fields
--
-- Context: replaces placeholder tagline/description/learning_outcomes
-- for all 7 programmes with the final copy provided by the platform
-- owner, and adds two small display fields (`mode`, `placement_assistance`)
-- so the public programme page's new feature grid (Duration/Mode/
-- Level/Live Classes/Hands-on Projects/Career Guidance/Certificate/
-- Placement Assistance) is fully DB-driven — no per-programme value
-- is hardcoded in the frontend.
--
-- `difficulty` (used as "Level" on the feature grid) isn't specified
-- per-programme by the brief; inferred from the programme's own
-- description and the existing LaunchPad(=beginner)/Architect(=advanced)
-- naming convention already used by the first two programmes.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS mode                 text DEFAULT 'Live Online',
  ADD COLUMN IF NOT EXISTS placement_assistance  boolean DEFAULT true;

UPDATE programs SET
  tagline     = 'Your first step into cloud computing.',
  description = 'A 6-month AWS training program designed to build a strong foundation in cloud computing and prepare students for entry-level cloud roles.',
  difficulty  = 'beginner',
  learning_outcomes = ARRAY[
    'Understand cloud computing fundamentals and AWS global infrastructure',
    'Deploy and manage EC2, S3, IAM, VPC, RDS, and other core AWS services',
    'Learn cloud security, networking, and cost optimization',
    'Build hands-on cloud projects using real AWS environments',
    'Prepare for AWS certifications and cloud engineering careers'
  ]
WHERE slug = 'cloud-launchpad';

UPDATE programs SET
  tagline     = 'Design systems that scale.',
  description = 'A 6-month advanced AWS program focused on designing secure, scalable, and production-ready cloud architectures.',
  difficulty  = 'advanced',
  learning_outcomes = ARRAY[
    'Design highly available and fault-tolerant architectures',
    'Build advanced networking and hybrid cloud solutions',
    'Implement Auto Scaling, Load Balancing, and Serverless architectures',
    'Apply AWS Well-Architected Framework best practices',
    'Learn migration, disaster recovery, and enterprise cloud architecture'
  ]
WHERE slug = 'cloud-architect';

UPDATE programs SET
  tagline     = 'Turn data into decisions.',
  description = 'A 6-month beginner-friendly program covering the essential tools and concepts required to become a Data Analyst.',
  difficulty  = 'beginner',
  learning_outcomes = ARRAY[
    'Learn Excel, SQL, Power BI, and Python',
    'Perform data cleaning, analysis, and visualization',
    'Build interactive dashboards and reports',
    'Work on real business datasets',
    'Create an industry-ready analytics portfolio'
  ]
WHERE slug = 'data-launchpad';

UPDATE programs SET
  tagline     = 'Build modern data platforms.',
  description = 'A 6-month advanced program focused on data engineering, scalable data pipelines, and cloud-based analytics infrastructure.',
  difficulty  = 'advanced',
  learning_outcomes = ARRAY[
    'Design scalable data architectures',
    'Build ETL/ELT pipelines',
    'Work with data warehouses and cloud platforms',
    'Learn data governance and optimization',
    'Develop production-ready data solutions'
  ]
WHERE slug = 'data-architect';

UPDATE programs SET
  tagline     = 'Build applications that matter.',
  description = 'A 6-month full-stack development program covering modern frontend, backend, APIs, databases, and deployment.',
  difficulty  = 'beginner',
  learning_outcomes = ARRAY[
    'Learn HTML, CSS, JavaScript, and modern frameworks',
    'Build backend APIs and integrate databases',
    'Develop responsive full-stack applications',
    'Deploy real-world projects',
    'Build a strong developer portfolio'
  ]
WHERE slug = 'dev-launchpad';

UPDATE programs SET
  tagline     = 'Build intelligent applications with AI.',
  description = 'A 6-month advanced AI engineering program focused on Generative AI, LLMs, AI Agents, and production-ready AI applications.',
  difficulty  = 'advanced',
  learning_outcomes = ARRAY[
    'Learn Python for AI development',
    'Build applications using Large Language Models (LLMs)',
    'Develop Retrieval-Augmented Generation (RAG) systems',
    'Explore AI Agents, Prompt Engineering, and Context Engineering',
    'Deploy production-ready AI applications'
  ]
WHERE slug = 'ai-dev-architect';

UPDATE programs SET
  tagline     = 'Master coding interviews.',
  description = 'A 4-month intensive Data Structures & Algorithms program designed for placements and product-based company interviews.',
  difficulty  = 'intermediate',
  learning_outcomes = ARRAY[
    'Master core Data Structures and Algorithms',
    'Solve interview questions from top companies',
    'Improve problem-solving and optimization skills',
    'Practice coding contests and mock interviews',
    'Prepare for technical placement interviews'
  ]
WHERE slug = 'dsa-mastery';

-- ── Verify ────────────────────────────────────────────────────────
SELECT slug, tagline, difficulty, mode, placement_assistance,
       array_length(learning_outcomes, 1) AS highlight_count
FROM programs
ORDER BY display_order;
