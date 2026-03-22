/**
 * @file src/ai/topics.js
 * @description Grade/Subject/Topic curriculum mapping aligned to CCSS and NGSS standards
 * @agent DBA
 * @version 1.0.0
 */

export const CURRICULUM = {
  1: {
    Math: {
      topics: [
        'Number Sense (0-100)',
        'Addition within 20',
        'Subtraction within 20',
        'Measurement Basics',
        'Shapes and Geometry',
        'Counting and Cardinality',
        'Place Value (Tens and Ones)',
      ],
      standards: ['CCSS.MATH.CONTENT.1.OA', 'CCSS.MATH.CONTENT.1.NBT', 'CCSS.MATH.CONTENT.1.MD'],
    },
    ELA: {
      topics: [
        'Phonics and Phonemic Awareness',
        'Sight Words',
        'Reading Comprehension',
        'Writing Sentences',
        'Capitalization and Punctuation',
        'Vocabulary in Context',
      ],
      standards: ['CCSS.ELA-LITERACY.RF.1', 'CCSS.ELA-LITERACY.W.1', 'CCSS.ELA-LITERACY.RL.1'],
    },
    Science: {
      topics: [
        'Living vs Nonliving Things',
        'Plant Needs',
        'Animal Habitats',
        'Weather Patterns',
        'Seasons and Earth Changes',
      ],
      standards: ['NGSS.1-LS1', 'NGSS.1-ESS1', 'NGSS.1-PS4'],
    },
    'Social Studies': {
      topics: [
        'Family and Community',
        'Rules and Responsibilities',
        'Basic Maps and Directions',
        'US Symbols and Holidays',
        'Needs vs Wants',
      ],
      standards: ['C3.D2.His.1.K-2', 'C3.D2.Geo.1.K-2', 'C3.D2.Civ.1.K-2'],
    },
  },
  2: {
    Math: {
      topics: [
        'Place Value (Hundreds)',
        'Addition and Subtraction within 100',
        'Skip Counting (2s, 5s, 10s)',
        'Measurement with Rulers',
        'Basic Fractions (Halves, Thirds, Fourths)',
        'Time to the Nearest 5 Minutes',
        'Bar Graphs and Data',
      ],
      standards: ['CCSS.MATH.CONTENT.2.NBT', 'CCSS.MATH.CONTENT.2.OA', 'CCSS.MATH.CONTENT.2.MD'],
    },
    ELA: {
      topics: [
        'Reading Comprehension: Main Idea',
        'Writing Sentences and Paragraphs',
        'Nouns and Verbs',
        'Adjectives and Descriptive Writing',
        'Story Elements (Character, Setting, Plot)',
        'Spelling Patterns',
      ],
      standards: ['CCSS.ELA-LITERACY.RL.2', 'CCSS.ELA-LITERACY.W.2', 'CCSS.ELA-LITERACY.L.2'],
    },
    Science: {
      topics: [
        'Earth Science: Rocks and Soil',
        'Plant Life Cycles',
        'Animal Life Cycles',
        'Properties of Matter',
        'Water and Weather',
      ],
      standards: ['NGSS.2-LS2', 'NGSS.2-ESS1', 'NGSS.2-PS1'],
    },
    'Social Studies': {
      topics: [
        'Maps and Neighborhoods',
        'Goods and Services',
        'American History: Explorers',
        'Community Helpers',
        'Rights and Responsibilities',
      ],
      standards: ['C3.D2.His.1.K-2', 'C3.D2.Geo.2.K-2', 'C3.D2.Eco.1.K-2'],
    },
  },
  3: {
    Math: {
      topics: [
        'Multiplication Facts (1–10)',
        'Division Basics',
        'Fractions on a Number Line',
        'Area and Perimeter',
        'Multi-Digit Addition and Subtraction',
        'Rounding to Nearest 10 and 100',
        'Time and Elapsed Time',
      ],
      standards: ['CCSS.MATH.CONTENT.3.OA', 'CCSS.MATH.CONTENT.3.NBT', 'CCSS.MATH.CONTENT.3.NF', 'CCSS.MATH.CONTENT.3.MD'],
    },
    ELA: {
      topics: [
        'Paragraph Writing',
        'Grammar: Nouns, Verbs, Adjectives',
        'Reading Comprehension: Inference',
        'Point of View',
        'Prefixes and Suffixes',
        'Narrative Writing',
        'Informational Text Features',
      ],
      standards: ['CCSS.ELA-LITERACY.RL.3', 'CCSS.ELA-LITERACY.W.3', 'CCSS.ELA-LITERACY.L.3'],
    },
    Science: {
      topics: [
        'Life Cycles of Plants and Animals',
        'States of Matter',
        'Forces and Motion',
        'Ecosystems and Food Chains',
        'Weather and Climate Basics',
      ],
      standards: ['NGSS.3-LS1', 'NGSS.3-PS2', 'NGSS.3-ESS2'],
    },
    'Social Studies': {
      topics: [
        'US Geography: Regions',
        'Native American History',
        'American Government Basics',
        'Economics: Supply and Demand',
        'US Landmarks and Geography',
      ],
      standards: ['C3.D2.His.1.3-5', 'C3.D2.Geo.1.3-5', 'C3.D2.Civ.1.3-5'],
    },
  },
  4: {
    Math: {
      topics: [
        'Multi-Digit Multiplication',
        'Long Division',
        'Equivalent Fractions',
        'Decimals (Tenths and Hundredths)',
        'Angles and Geometry',
        'Factors and Multiples',
        'Multi-Step Word Problems',
      ],
      standards: ['CCSS.MATH.CONTENT.4.OA', 'CCSS.MATH.CONTENT.4.NBT', 'CCSS.MATH.CONTENT.4.NF', 'CCSS.MATH.CONTENT.4.G'],
    },
    ELA: {
      topics: [
        'Essay Writing: Opinion',
        'Figurative Language (Simile, Metaphor)',
        'Reading Comprehension: Theme',
        'Grammar: Pronouns and Conjunctions',
        'Research Writing Skills',
        'Vocabulary: Context Clues',
      ],
      standards: ['CCSS.ELA-LITERACY.RL.4', 'CCSS.ELA-LITERACY.W.4', 'CCSS.ELA-LITERACY.L.4'],
    },
    Science: {
      topics: [
        'Ecosystems and Adaptations',
        'Energy: Forms and Transfer',
        'Waves: Light and Sound',
        'Earth Processes: Erosion and Weathering',
        'Animal Structures and Functions',
      ],
      standards: ['NGSS.4-LS1', 'NGSS.4-PS3', 'NGSS.4-PS4', 'NGSS.4-ESS2'],
    },
    'Social Studies': {
      topics: [
        'US States and Capitals',
        'American Revolution',
        'Colonial America',
        'Branches of Government',
        'Economics: Trade and Resources',
      ],
      standards: ['C3.D2.His.1.3-5', 'C3.D2.Geo.3.3-5', 'C3.D2.Civ.3.3-5'],
    },
  },
  5: {
    Math: {
      topics: [
        'Fractions: Addition and Subtraction',
        'Fractions: Multiplication and Division',
        'Decimals: Operations',
        'Volume of Rectangular Prisms',
        'Coordinate Planes',
        'Order of Operations',
        'Patterns and Relationships',
      ],
      standards: ['CCSS.MATH.CONTENT.5.NBT', 'CCSS.MATH.CONTENT.5.NF', 'CCSS.MATH.CONTENT.5.MD', 'CCSS.MATH.CONTENT.5.G'],
    },
    ELA: {
      topics: [
        'Literary Analysis',
        'Persuasive Writing',
        'Reading Comprehension: Compare and Contrast',
        'Grammar: Verb Tense and Modifiers',
        'Research Report Writing',
        'Poetry Analysis',
      ],
      standards: ['CCSS.ELA-LITERACY.RL.5', 'CCSS.ELA-LITERACY.W.5', 'CCSS.ELA-LITERACY.L.5'],
    },
    Science: {
      topics: [
        'Earth Systems: Atmosphere and Hydrosphere',
        'Space Science: Solar System',
        'Matter: Properties and Changes',
        'Ecosystems: Energy Flow',
        'Introduction to Chemistry',
      ],
      standards: ['NGSS.5-LS2', 'NGSS.5-ESS1', 'NGSS.5-PS1'],
    },
    'Social Studies': {
      topics: [
        'US History: Civil War Era',
        'US Civics: Constitution and Bill of Rights',
        'Westward Expansion',
        'US Geography: Physical Features',
        'Economics: Markets and Trade',
      ],
      standards: ['C3.D2.His.1.3-5', 'C3.D2.Civ.5.3-5', 'C3.D2.Eco.3.3-5'],
    },
  },
  6: {
    Math: {
      topics: [
        'Ratios and Proportional Relationships',
        'Introduction to Integers',
        'Expressions and Equations',
        'Geometry: Area and Surface Area',
        'Statistics: Mean, Median, Mode',
        'Percentages',
        'Pre-Algebra: Variables',
      ],
      standards: ['CCSS.MATH.CONTENT.6.RP', 'CCSS.MATH.CONTENT.6.NS', 'CCSS.MATH.CONTENT.6.EE', 'CCSS.MATH.CONTENT.6.SP'],
    },
    ELA: {
      topics: [
        'Narrative Writing',
        'Vocabulary: Greek and Latin Roots',
        'Reading Comprehension: Argumentative Texts',
        'Grammar: Sentence Structure',
        'Research and Citation Skills',
        'Literary Devices',
      ],
      standards: ['CCSS.ELA-LITERACY.RL.6', 'CCSS.ELA-LITERACY.W.6', 'CCSS.ELA-LITERACY.L.6'],
    },
    Science: {
      topics: [
        'Cell Structure and Function',
        'Earth Systems: Plate Tectonics',
        'Weather and Climate Systems',
        'Ecosystems: Biodiversity',
        'Introduction to the Atom',
      ],
      standards: ['NGSS.MS-LS1', 'NGSS.MS-ESS2', 'NGSS.MS-PS1'],
    },
    'Social Studies': {
      topics: [
        'World Geography: Continents and Regions',
        'Ancient Civilizations: Mesopotamia and Egypt',
        'World Religions: Introduction',
        'Economics: Global Trade',
        'Government Systems Around the World',
      ],
      standards: ['C3.D2.His.1.6-8', 'C3.D2.Geo.1.6-8', 'C3.D2.Eco.1.6-8'],
    },
    Health: {
      topics: [
        'Nutrition and Healthy Eating',
        'Physical Fitness and Exercise',
        'Mental Health and Wellness',
        'Puberty and Adolescent Development',
        'Substance Abuse Prevention',
        'Personal Safety and Boundaries',
      ],
      standards: ['NHES.1.8', 'NHES.7.8'],
    },
  },
  7: {
    Math: {
      topics: [
        'Proportional Relationships',
        'Operations with Rational Numbers',
        'Linear Expressions and Equations',
        'Geometry: Scale Drawings and Circles',
        'Statistics and Probability',
        'Inequalities',
      ],
      standards: ['CCSS.MATH.CONTENT.7.RP', 'CCSS.MATH.CONTENT.7.NS', 'CCSS.MATH.CONTENT.7.EE', 'CCSS.MATH.CONTENT.7.SP'],
    },
    ELA: {
      topics: [
        'Argumentative Essay Writing',
        'Literary Devices: Symbolism and Irony',
        'Research Writing: MLA Format',
        'Grammar: Syntax and Punctuation',
        'Reading Comprehension: Complex Texts',
        'Vocabulary: Academic Word List',
      ],
      standards: ['CCSS.ELA-LITERACY.RL.7', 'CCSS.ELA-LITERACY.W.7', 'CCSS.ELA-LITERACY.L.7'],
    },
    Science: {
      topics: [
        'Life Science: Genetics and Heredity',
        'Life Science: Evolution and Natural Selection',
        'Earth Science: Rock Cycle and Minerals',
        'Physical Science: Forces and Motion',
        'Human Body Systems',
      ],
      standards: ['NGSS.MS-LS3', 'NGSS.MS-LS4', 'NGSS.MS-PS2', 'NGSS.MS-ESS3'],
    },
    'Social Studies': {
      topics: [
        'World History: Medieval Europe',
        'World History: Islamic Civilization',
        'World History: African Kingdoms',
        'Geography: Climate Zones',
        'Comparative Government Systems',
      ],
      standards: ['C3.D2.His.1.6-8', 'C3.D2.Geo.4.6-8', 'C3.D2.Civ.2.6-8'],
    },
    Health: {
      topics: [
        'Mental Health: Stress and Coping',
        'Relationships and Communication',
        'Tobacco, Alcohol, and Drug Prevention',
        'Sexual Health Education',
        'First Aid and Safety',
        'Disease Prevention',
      ],
      standards: ['NHES.2.8', 'NHES.4.8', 'NHES.7.8'],
    },
  },
  8: {
    Math: {
      topics: [
        'Linear Equations and Systems',
        'Functions and Slope',
        'Exponents and Scientific Notation',
        'Geometry: Pythagorean Theorem',
        'Transformations on the Coordinate Plane',
        'Statistics: Scatter Plots and Trend Lines',
      ],
      standards: ['CCSS.MATH.CONTENT.8.EE', 'CCSS.MATH.CONTENT.8.F', 'CCSS.MATH.CONTENT.8.G', 'CCSS.MATH.CONTENT.8.SP'],
    },
    ELA: {
      topics: [
        'Argumentative Essay: Evidence and Claims',
        'Language Conventions: Formal vs Informal',
        'Reading Comprehension: Synthesis Across Texts',
        'Research: Evaluating Sources',
        'Grammar: Complex Sentences',
        'Vocabulary: Connotation and Denotation',
      ],
      standards: ['CCSS.ELA-LITERACY.RL.8', 'CCSS.ELA-LITERACY.W.8', 'CCSS.ELA-LITERACY.L.8'],
    },
    Science: {
      topics: [
        'Physical Science: Wave Properties',
        'Physical Science: Electromagnetic Spectrum',
        'Earth Science: Climate Change Evidence',
        'Chemistry: Chemical Reactions Basics',
        'Physics: Newton\'s Laws of Motion',
      ],
      standards: ['NGSS.MS-PS4', 'NGSS.MS-ESS3', 'NGSS.MS-PS1', 'NGSS.MS-PS2'],
    },
    'Social Studies': {
      topics: [
        'US History: Industrial Revolution',
        'US History: Reconstruction',
        'US History: Immigration (1800s–1900s)',
        'US History: Progressive Era',
        'US History: Westward Expansion and Manifest Destiny',
      ],
      standards: ['C3.D2.His.1.6-8', 'C3.D2.His.5.6-8', 'C3.D2.Civ.6.6-8'],
    },
  },
  9: {
    Math: {
      topics: [
        'Algebra I: Linear Equations',
        'Algebra I: Inequalities',
        'Algebra I: Systems of Equations',
        'Algebra I: Polynomials',
        'Geometry: Proofs and Congruence',
        'Algebra I: Quadratic Equations',
        'Algebra I: Functions',
      ],
      standards: ['CCSS.MATH.CONTENT.HSA.REI', 'CCSS.MATH.CONTENT.HSA.CED', 'CCSS.MATH.CONTENT.HSG.CO'],
    },
    ELA: {
      topics: [
        'American Literature: Short Stories',
        'Composition: Expository Writing',
        'Composition: Persuasive Writing',
        'Reading: Analyzing Rhetoric',
        'Grammar: Advanced Conventions',
        'Vocabulary: SAT Prep Words',
      ],
      standards: ['CCSS.ELA-LITERACY.RL.9-10', 'CCSS.ELA-LITERACY.W.9-10', 'CCSS.ELA-LITERACY.L.9-10'],
    },
    Science: {
      topics: [
        'Biology: Cell Division (Mitosis and Meiosis)',
        'Biology: DNA and Protein Synthesis',
        'Biology: Evolution and Natural Selection',
        'Biology: Ecology and Ecosystems',
        'Biology: Human Body Systems',
      ],
      standards: ['NGSS.HS-LS1', 'NGSS.HS-LS2', 'NGSS.HS-LS3', 'NGSS.HS-LS4'],
    },
    'Social Studies': {
      topics: [
        'World History: World War I',
        'World History: Russian Revolution',
        'World History: Rise of Totalitarianism',
        'World History: Colonialism and Imperialism',
        'World History: Ancient to Medieval Transitions',
      ],
      standards: ['C3.D2.His.1.9-12', 'C3.D2.Geo.1.9-12', 'C3.D2.Civ.1.9-12'],
    },
    Health: {
      topics: [
        'Mental Health: Anxiety and Depression Awareness',
        'Healthy Relationships and Consent',
        'Reproductive Health Education',
        'Nutrition: Macronutrients and Micronutrients',
        'Fitness Planning and Goal Setting',
        'Substance Abuse: Understanding Addiction',
      ],
      standards: ['NHES.1.12', 'NHES.4.12', 'NHES.7.12'],
    },
  },
  10: {
    Math: {
      topics: [
        'Algebra II: Complex Numbers',
        'Algebra II: Rational Functions',
        'Algebra II: Logarithms and Exponentials',
        'Geometry: Circles and Trigonometry',
        'Algebra II: Sequences and Series',
        'Statistics: Normal Distribution',
        'Algebra II: Conic Sections',
      ],
      standards: ['CCSS.MATH.CONTENT.HSA.APR', 'CCSS.MATH.CONTENT.HSF.BF', 'CCSS.MATH.CONTENT.HSG.C'],
    },
    ELA: {
      topics: [
        'World Literature: Major Works',
        'Advanced Composition: Research Papers',
        'Analytical Writing: Literary Criticism',
        'Rhetoric and Argumentation',
        'Reading: Postcolonial Literature',
        'Vocabulary: Advanced Academic Words',
      ],
      standards: ['CCSS.ELA-LITERACY.RL.9-10', 'CCSS.ELA-LITERACY.W.9-10', 'CCSS.ELA-LITERACY.RH.9-10'],
    },
    Science: {
      topics: [
        'Chemistry: Atomic Structure and Periodic Table',
        'Chemistry: Chemical Bonding',
        'Chemistry: Stoichiometry',
        'Physics: Kinematics and Dynamics',
        'Physics: Energy and Thermodynamics',
      ],
      standards: ['NGSS.HS-PS1', 'NGSS.HS-PS2', 'NGSS.HS-PS3'],
    },
    'Social Studies': {
      topics: [
        'US Government: Constitutional Law',
        'US History: World War II',
        'US History: Cold War',
        'US History: Civil Rights Movement',
        'AP-Level US Government and Politics',
      ],
      standards: ['C3.D2.His.1.9-12', 'C3.D2.Civ.8.9-12', 'C3.D2.Eco.5.9-12'],
    },
  },
};

/**
 * Returns available subjects for a given grade
 * @param {number} grade - Grade level 1–10
 * @returns {string[]} Array of subject names
 */
export function getSubjectsForGrade(grade) {
  return Object.keys(CURRICULUM[grade] || {});
}

/**
 * Returns available topics for a given grade and subject
 * @param {number} grade - Grade level 1–10
 * @param {string} subject - Subject name
 * @returns {string[]} Array of topic names
 */
export function getTopicsForGradeSubject(grade, subject) {
  return CURRICULUM[grade]?.[subject]?.topics || [];
}
