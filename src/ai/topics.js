/**
 * @file src/ai/topics.js
 * @description Authoritative Grade/Subject/Topic curriculum mapping for Learnfyra.
 *   Aligned to:
 *     - CCSS (Common Core State Standards) for Math and ELA
 *     - NGSS (Next Generation Science Standards) for Science
 *     - C3 Framework for Social Studies
 *     - NHES (National Health Education Standards) for Health
 *
 * Schema per entry:
 *   topics       {string[]}  — 8-10 specific, teachable topic strings shown in the CLI
 *   standards    {string[]}  — Authoritative standard codes at domain/cluster level
 *   description  {string}    — One-line context hint sent to Claude in the system prompt
 *   questionTypes {string[]} — Preferred question types for this subject at this grade band
 *
 * @agent DBA
 * @version 1.1.0
 * @changelog
 *   1.1.0 — Expanded all grades to 8-10 topics each; added cluster-level standard codes;
 *            added description and questionTypes fields; verified NHES grade bands.
 *   1.0.0 — Initial scaffold created during project initialization.
 */

// ─── Shared question-type sets by subject and grade band ─────────────────────

const QT = {
  mathElem:   ['fill-in-the-blank', 'multiple-choice', 'true-false', 'word-problem', 'show-your-work'],
  mathMid:    ['fill-in-the-blank', 'multiple-choice', 'word-problem', 'show-your-work', 'short-answer'],
  mathHS:     ['fill-in-the-blank', 'multiple-choice', 'word-problem', 'show-your-work', 'short-answer'],
  elaElem:    ['multiple-choice', 'fill-in-the-blank', 'short-answer', 'matching', 'true-false'],
  elaMid:     ['multiple-choice', 'short-answer', 'fill-in-the-blank', 'matching'],
  elaHS:      ['multiple-choice', 'short-answer', 'fill-in-the-blank'],
  science:    ['multiple-choice', 'true-false', 'short-answer', 'fill-in-the-blank', 'matching'],
  socStudies: ['multiple-choice', 'matching', 'short-answer', 'fill-in-the-blank', 'true-false'],
  health:     ['multiple-choice', 'true-false', 'short-answer', 'fill-in-the-blank'],
};

// ─── Curriculum Map ──────────────────────────────────────────────────────────

export const CURRICULUM = {

  // ══════════════════════════════════════════════════════════════════════════
  // GRADE 1
  // ══════════════════════════════════════════════════════════════════════════
  1: {
    Math: {
      topics: [
        'Counting and Cardinality (0–120)',
        'Addition within 20',
        'Subtraction within 20',
        'Place Value: Tens and Ones',
        'Comparing Two-Digit Numbers',
        'Measurement: Length and Time',
        '2D and 3D Shapes',
        'Organizing and Interpreting Data',
        'Addition and Subtraction Word Problems',
        'Even and Odd Numbers',
      ],
      standards: [
        'CCSS.MATH.CONTENT.1.OA.A.1',
        'CCSS.MATH.CONTENT.1.OA.C.6',
        'CCSS.MATH.CONTENT.1.NBT.B.2',
        'CCSS.MATH.CONTENT.1.NBT.C.4',
        'CCSS.MATH.CONTENT.1.MD.A.1',
        'CCSS.MATH.CONTENT.1.MD.C.4',
        'CCSS.MATH.CONTENT.1.G.A.1',
      ],
      description: 'Grade 1 foundational arithmetic, place value to 100, basic geometry, and data.',
      questionTypes: QT.mathElem,
    },
    ELA: {
      topics: [
        'Phonics: Short and Long Vowel Patterns',
        'Sight Words (Dolch Pre-Primer through Grade 1)',
        'Reading Comprehension: Main Idea and Key Details',
        'Reading Informational Texts',
        'Writing: Complete Sentences and Labels',
        'Capitalization and End Punctuation',
        'Nouns and Verbs (Introduction)',
        'Vocabulary: Words from Illustrations and Context',
        'Retelling Stories with Key Details',
        'Rhyme, Alliteration, and Word Families',
      ],
      standards: [
        'CCSS.ELA-LITERACY.RF.1.2',
        'CCSS.ELA-LITERACY.RF.1.3',
        'CCSS.ELA-LITERACY.RL.1.1',
        'CCSS.ELA-LITERACY.RL.1.2',
        'CCSS.ELA-LITERACY.RI.1.1',
        'CCSS.ELA-LITERACY.W.1.2',
        'CCSS.ELA-LITERACY.L.1.1',
        'CCSS.ELA-LITERACY.L.1.2',
      ],
      description: 'Grade 1 foundational literacy: phonics, sight words, basic comprehension, and sentence-level writing.',
      questionTypes: QT.elaElem,
    },
    Science: {
      topics: [
        'Living vs Nonliving Things',
        'Plant Structures and What Plants Need',
        'Animal Habitats and Survival Needs',
        'Sunlight, Warmth, and Plant Growth',
        'Seasonal Changes on Earth',
        'Sound: Vibration and Volume',
        'Light: Sources, Shadows, and Reflection',
        'Patterns in the Sky: Sun, Moon, Stars',
      ],
      standards: [
        'NGSS.1-LS1-1',
        'NGSS.1-LS1-2',
        'NGSS.1-LS3-1',
        'NGSS.1-ESS1-1',
        'NGSS.1-ESS1-2',
        'NGSS.1-PS4-1',
        'NGSS.1-PS4-2',
        'NGSS.1-PS4-3',
      ],
      description: 'Grade 1 NGSS life science, earth science, and physical science basics.',
      questionTypes: QT.science,
    },
    'Social Studies': {
      topics: [
        'Family Structures and Community Roles',
        'Rules, Laws, and Why They Matter',
        'Map Skills: Cardinal Directions and Map Symbols',
        'US Symbols: Flag, Pledge, National Monuments',
        'National Holidays and Their Meaning',
        'Needs vs Wants: Basic Economic Concepts',
        'Timelines: Past, Present, and Future',
        'Contributions of Historical Figures (Lincoln, MLK Jr.)',
      ],
      standards: [
        'C3.D2.His.1.K-2',
        'C3.D2.His.2.K-2',
        'C3.D2.Geo.1.K-2',
        'C3.D2.Geo.2.K-2',
        'C3.D2.Civ.1.K-2',
        'C3.D2.Civ.3.K-2',
        'C3.D2.Eco.1.K-2',
      ],
      description: 'Grade 1 community, civic, geographic, and basic economic concepts.',
      questionTypes: QT.socStudies,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GRADE 2
  // ══════════════════════════════════════════════════════════════════════════
  2: {
    Math: {
      topics: [
        'Place Value to 1,000',
        'Addition and Subtraction within 1,000',
        'Skip Counting: 2s, 5s, 10s, 100s',
        'Measurement: Inches, Feet, Centimeters, Meters',
        'Telling Time to the Nearest 5 Minutes',
        'Money: Counting Coins and Bills',
        'Basic Fractions: Halves, Thirds, Fourths',
        'Bar Graphs, Pictographs, and Line Plots',
        'Even and Odd Numbers',
        'Addition and Subtraction Word Problems',
      ],
      standards: [
        'CCSS.MATH.CONTENT.2.OA.A.1',
        'CCSS.MATH.CONTENT.2.OA.C.3',
        'CCSS.MATH.CONTENT.2.NBT.A.1',
        'CCSS.MATH.CONTENT.2.NBT.B.5',
        'CCSS.MATH.CONTENT.2.NBT.B.7',
        'CCSS.MATH.CONTENT.2.MD.A.1',
        'CCSS.MATH.CONTENT.2.MD.C.7',
        'CCSS.MATH.CONTENT.2.MD.D.10',
        'CCSS.MATH.CONTENT.2.G.A.3',
      ],
      description: 'Grade 2 three-digit place value, measurement, money, time, and fractions.',
      questionTypes: QT.mathElem,
    },
    ELA: {
      topics: [
        'Phonics: Blends, Digraphs, and Vowel Teams',
        'Reading Comprehension: Main Idea and Supporting Details',
        'Reading Comprehension: Cause and Effect',
        'Story Elements: Character, Setting, Problem, Solution',
        'Writing: Opinion Paragraphs',
        'Writing: Informational Paragraphs',
        'Nouns: Common, Proper, Plural, and Possessive',
        'Verbs: Action, Linking, and Helping Verbs',
        'Adjectives and Adverbs',
        'Vocabulary: Compound Words, Contractions, and Synonyms',
      ],
      standards: [
        'CCSS.ELA-LITERACY.RF.2.3',
        'CCSS.ELA-LITERACY.RL.2.1',
        'CCSS.ELA-LITERACY.RL.2.3',
        'CCSS.ELA-LITERACY.RL.2.5',
        'CCSS.ELA-LITERACY.RI.2.1',
        'CCSS.ELA-LITERACY.RI.2.6',
        'CCSS.ELA-LITERACY.W.2.1',
        'CCSS.ELA-LITERACY.W.2.2',
        'CCSS.ELA-LITERACY.L.2.1',
        'CCSS.ELA-LITERACY.L.2.2',
      ],
      description: 'Grade 2 expanding literacy: phonics patterns, paragraph-level writing, and grammar.',
      questionTypes: QT.elaElem,
    },
    Science: {
      topics: [
        'Properties of Matter: Solids, Liquids, and Gases',
        'Changing Matter: Heating and Cooling',
        'Plant Life Cycles',
        'Animal Life Cycles and Diversity',
        'Earth\'s Materials: Rocks, Soil, and Fossils',
        'Landforms and Bodies of Water',
        'Weather: Measurement and Patterns',
        'How Maps Show Land and Water',
      ],
      standards: [
        'NGSS.2-PS1-1',
        'NGSS.2-PS1-2',
        'NGSS.2-PS1-3',
        'NGSS.2-PS1-4',
        'NGSS.2-LS2-1',
        'NGSS.2-LS2-2',
        'NGSS.2-LS4-1',
        'NGSS.2-ESS1-1',
        'NGSS.2-ESS2-1',
        'NGSS.2-ESS2-2',
      ],
      description: 'Grade 2 NGSS properties of matter, life cycles, and Earth materials.',
      questionTypes: QT.science,
    },
    'Social Studies': {
      topics: [
        'Maps: Continents, Oceans, Countries, and States',
        'Economics: Goods, Services, Producers, and Consumers',
        'How Communities Change Over Time',
        'Famous Americans and Their Contributions',
        'Native American Peoples and Cultures',
        'Government: Local, State, and National',
        'Immigration and the American Story',
        'Geography: Using Maps and Globes',
      ],
      standards: [
        'C3.D2.His.1.K-2',
        'C3.D2.His.3.K-2',
        'C3.D2.Geo.1.K-2',
        'C3.D2.Geo.3.K-2',
        'C3.D2.Civ.1.K-2',
        'C3.D2.Eco.1.K-2',
        'C3.D2.Eco.2.K-2',
      ],
      description: 'Grade 2 community history, maps, economics, and government roles.',
      questionTypes: QT.socStudies,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GRADE 3
  // ══════════════════════════════════════════════════════════════════════════
  3: {
    Math: {
      topics: [
        'Multiplication Facts (1–10)',
        'Division: Equal Groups and Arrays',
        'Relationship Between Multiplication and Division',
        'Fractions: Understanding Unit Fractions',
        'Fractions on a Number Line',
        'Area of Rectangles',
        'Perimeter',
        'Multi-Digit Addition and Subtraction',
        'Rounding to Nearest 10 and 100',
        'Elapsed Time and Telling Time',
      ],
      standards: [
        'CCSS.MATH.CONTENT.3.OA.A.1',
        'CCSS.MATH.CONTENT.3.OA.A.2',
        'CCSS.MATH.CONTENT.3.OA.B.5',
        'CCSS.MATH.CONTENT.3.OA.C.7',
        'CCSS.MATH.CONTENT.3.NBT.A.1',
        'CCSS.MATH.CONTENT.3.NBT.A.2',
        'CCSS.MATH.CONTENT.3.NF.A.1',
        'CCSS.MATH.CONTENT.3.NF.A.2',
        'CCSS.MATH.CONTENT.3.MD.C.5',
        'CCSS.MATH.CONTENT.3.MD.D.8',
      ],
      description: 'Grade 3 multiplication, division, fractions, area, and rounding.',
      questionTypes: QT.mathElem,
    },
    ELA: {
      topics: [
        'Reading Comprehension: Asking and Answering Questions',
        'Reading Comprehension: Inference and Evidence',
        'Story Elements: Theme, Moral, and Point of View',
        'Informational Text: Main Idea and Key Details',
        'Paragraph Writing: Topic, Detail, Conclusion',
        'Narrative Writing',
        'Opinion Writing with Reasons and Evidence',
        'Grammar: Nouns, Verbs, Adjectives, and Adverbs',
        'Prefixes and Suffixes',
        'Vocabulary: Context Clues and Dictionary Skills',
      ],
      standards: [
        'CCSS.ELA-LITERACY.RL.3.1',
        'CCSS.ELA-LITERACY.RL.3.2',
        'CCSS.ELA-LITERACY.RL.3.6',
        'CCSS.ELA-LITERACY.RI.3.2',
        'CCSS.ELA-LITERACY.RI.3.5',
        'CCSS.ELA-LITERACY.W.3.1',
        'CCSS.ELA-LITERACY.W.3.2',
        'CCSS.ELA-LITERACY.W.3.3',
        'CCSS.ELA-LITERACY.L.3.1',
        'CCSS.ELA-LITERACY.L.3.4',
      ],
      description: 'Grade 3 structured paragraph writing, literary themes, and advanced grammar.',
      questionTypes: QT.elaElem,
    },
    Science: {
      topics: [
        'Life Cycles of Plants',
        'Life Cycles of Animals',
        'Inheritance: Traits from Parents to Offspring',
        'Adaptations: How Organisms Survive',
        'Ecosystems and Food Chains',
        'Fossils as Evidence of Past Life',
        'Forces: Pushes and Pulls',
        'Magnets and Magnetic Forces',
        'Weather, Climate, and Severe Weather Preparedness',
        'Conservation of Natural Resources',
      ],
      standards: [
        'NGSS.3-LS1-1',
        'NGSS.3-LS2-1',
        'NGSS.3-LS3-1',
        'NGSS.3-LS3-2',
        'NGSS.3-LS4-1',
        'NGSS.3-LS4-2',
        'NGSS.3-PS2-1',
        'NGSS.3-PS2-3',
        'NGSS.3-ESS2-1',
        'NGSS.3-ESS3-1',
      ],
      description: 'Grade 3 NGSS life cycles, adaptations, forces, and climate.',
      questionTypes: QT.science,
    },
    'Social Studies': {
      topics: [
        'US Geography: Five Regions',
        'Physical and Political Maps',
        'Native American Peoples: Regions and Cultures',
        'Colonial America: The 13 Colonies',
        'American Revolution: Causes and Key Events',
        'US Government: Three Branches',
        'Economics: Supply, Demand, and Trade',
        'Community: Then and Now',
      ],
      standards: [
        'C3.D2.His.1.3-5',
        'C3.D2.His.2.3-5',
        'C3.D2.Geo.1.3-5',
        'C3.D2.Geo.2.3-5',
        'C3.D2.Civ.1.3-5',
        'C3.D2.Civ.3.3-5',
        'C3.D2.Eco.1.3-5',
      ],
      description: 'Grade 3 US regions, early American history, and government basics.',
      questionTypes: QT.socStudies,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GRADE 4
  // ══════════════════════════════════════════════════════════════════════════
  4: {
    Math: {
      topics: [
        'Multi-Digit Multiplication (up to 4 digits)',
        'Long Division with Remainders',
        'Factors, Multiples, Prime, and Composite Numbers',
        'Equivalent Fractions',
        'Comparing and Ordering Fractions',
        'Adding and Subtracting Fractions with Like Denominators',
        'Decimals: Tenths and Hundredths',
        'Comparing Decimals',
        'Angles and Angle Measurement',
        'Symmetry, Lines, and Properties of Shapes',
      ],
      standards: [
        'CCSS.MATH.CONTENT.4.OA.A.1',
        'CCSS.MATH.CONTENT.4.OA.B.4',
        'CCSS.MATH.CONTENT.4.NBT.B.5',
        'CCSS.MATH.CONTENT.4.NBT.B.6',
        'CCSS.MATH.CONTENT.4.NF.A.1',
        'CCSS.MATH.CONTENT.4.NF.A.2',
        'CCSS.MATH.CONTENT.4.NF.B.3',
        'CCSS.MATH.CONTENT.4.NF.C.6',
        'CCSS.MATH.CONTENT.4.MD.C.5',
        'CCSS.MATH.CONTENT.4.G.A.1',
      ],
      description: 'Grade 4 multi-digit operations, fraction equivalence, decimals, and geometry.',
      questionTypes: QT.mathElem,
    },
    ELA: {
      topics: [
        'Reading Comprehension: Theme and Summary',
        'Reading Comprehension: Text Structure (Cause/Effect, Compare/Contrast)',
        'Figurative Language: Simile, Metaphor, Personification, Idiom',
        'Reading Informational Text: Main Idea and Details',
        'Opinion Essay Writing',
        'Informational Essay Writing',
        'Narrative Writing with Dialogue and Description',
        'Grammar: Pronouns, Conjunctions, and Prepositions',
        'Vocabulary: Context Clues and Multiple-Meaning Words',
        'Research Skills: Finding and Using Sources',
      ],
      standards: [
        'CCSS.ELA-LITERACY.RL.4.1',
        'CCSS.ELA-LITERACY.RL.4.2',
        'CCSS.ELA-LITERACY.RL.4.4',
        'CCSS.ELA-LITERACY.RI.4.2',
        'CCSS.ELA-LITERACY.RI.4.5',
        'CCSS.ELA-LITERACY.W.4.1',
        'CCSS.ELA-LITERACY.W.4.2',
        'CCSS.ELA-LITERACY.W.4.3',
        'CCSS.ELA-LITERACY.L.4.1',
        'CCSS.ELA-LITERACY.L.4.4',
      ],
      description: 'Grade 4 figurative language, multi-paragraph essays, and complex text analysis.',
      questionTypes: QT.elaElem,
    },
    Science: {
      topics: [
        'Energy: Forms, Transfer, and Conservation',
        'Electricity and Circuits',
        'Waves: Properties of Sound and Light',
        'Plant and Animal Structures and Functions',
        'Internal and External Structures for Survival',
        'Animal Communication and Behavior',
        'Earth\'s Landforms: Erosion, Weathering, and Deposition',
        'Natural Disasters: Earthquakes, Volcanoes, and Floods',
        'Earth\'s Water Cycle',
        'Human Impact on Earth\'s Resources',
      ],
      standards: [
        'NGSS.4-PS3-1',
        'NGSS.4-PS3-2',
        'NGSS.4-PS3-3',
        'NGSS.4-PS4-1',
        'NGSS.4-PS4-2',
        'NGSS.4-LS1-1',
        'NGSS.4-LS1-2',
        'NGSS.4-ESS1-1',
        'NGSS.4-ESS2-1',
        'NGSS.4-ESS2-2',
      ],
      description: 'Grade 4 NGSS energy, waves, organism structures, and Earth processes.',
      questionTypes: QT.science,
    },
    'Social Studies': {
      topics: [
        'US States, Capitals, and Regional Geography',
        'Colonial America: Life, Government, and Economy',
        'American Revolution: Causes, Events, and Key Figures',
        'Declaration of Independence',
        'Early US Government: Articles of Confederation to Constitution',
        'Branches of Government and Checks and Balances',
        'Westward Expansion: Louisiana Purchase and Lewis and Clark',
        'Economics: Opportunity Cost, Scarcity, and Resources',
      ],
      standards: [
        'C3.D2.His.1.3-5',
        'C3.D2.His.3.3-5',
        'C3.D2.His.5.3-5',
        'C3.D2.Geo.1.3-5',
        'C3.D2.Geo.3.3-5',
        'C3.D2.Civ.3.3-5',
        'C3.D2.Civ.6.3-5',
        'C3.D2.Eco.1.3-5',
      ],
      description: 'Grade 4 American colonial history, revolution, geography, and early government.',
      questionTypes: QT.socStudies,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GRADE 5
  // ══════════════════════════════════════════════════════════════════════════
  5: {
    Math: {
      topics: [
        'Order of Operations (PEMDAS)',
        'Place Value: Decimals to Thousandths',
        'Adding and Subtracting Decimals',
        'Multiplying Decimals',
        'Dividing Decimals',
        'Adding and Subtracting Fractions with Unlike Denominators',
        'Multiplying Fractions and Mixed Numbers',
        'Dividing Unit Fractions by Whole Numbers',
        'Volume of Rectangular Prisms',
        'Coordinate Planes: Graphing Points',
      ],
      standards: [
        'CCSS.MATH.CONTENT.5.OA.A.1',
        'CCSS.MATH.CONTENT.5.NBT.A.1',
        'CCSS.MATH.CONTENT.5.NBT.A.3',
        'CCSS.MATH.CONTENT.5.NBT.B.5',
        'CCSS.MATH.CONTENT.5.NBT.B.7',
        'CCSS.MATH.CONTENT.5.NF.A.1',
        'CCSS.MATH.CONTENT.5.NF.B.4',
        'CCSS.MATH.CONTENT.5.NF.B.7',
        'CCSS.MATH.CONTENT.5.MD.C.3',
        'CCSS.MATH.CONTENT.5.G.A.1',
      ],
      description: 'Grade 5 decimal operations, fraction multiplication/division, volume, and coordinate planes.',
      questionTypes: QT.mathElem,
    },
    ELA: {
      topics: [
        'Literary Analysis: Theme, Conflict, and Resolution',
        'Poetry: Figurative Language and Structure',
        'Reading Comprehension: Point of View and Perspective',
        'Informational Text: Summarizing Complex Articles',
        'Compare and Contrast: Two Texts on the Same Topic',
        'Opinion Writing with Evidence from Multiple Sources',
        'Research Report Writing',
        'Narrative Writing: Dialogue, Pacing, and Sensory Details',
        'Grammar: Verb Tense, Modifiers, and Sentence Types',
        'Vocabulary: Greek and Latin Roots (Introduction)',
      ],
      standards: [
        'CCSS.ELA-LITERACY.RL.5.1',
        'CCSS.ELA-LITERACY.RL.5.2',
        'CCSS.ELA-LITERACY.RL.5.6',
        'CCSS.ELA-LITERACY.RI.5.1',
        'CCSS.ELA-LITERACY.RI.5.9',
        'CCSS.ELA-LITERACY.W.5.1',
        'CCSS.ELA-LITERACY.W.5.2',
        'CCSS.ELA-LITERACY.W.5.3',
        'CCSS.ELA-LITERACY.L.5.1',
        'CCSS.ELA-LITERACY.L.5.4',
      ],
      description: 'Grade 5 literary analysis, research writing, poetry, and advanced grammar.',
      questionTypes: QT.elaElem,
    },
    Science: {
      topics: [
        'Matter: Properties and States',
        'Physical and Chemical Changes of Matter',
        'Mixtures and Solutions',
        'Ecosystems: Energy Flow and Food Webs',
        'Earth\'s Systems: Geosphere, Hydrosphere, Atmosphere, Biosphere',
        'Earth\'s Water Cycle and Weather',
        'Earth in the Solar System: Seasons and Day/Night',
        'Space: Stars, Planets, and the Moon',
        'Human Impact on Earth\'s Environment',
        'Conservation and Biodiversity',
      ],
      standards: [
        'NGSS.5-PS1-1',
        'NGSS.5-PS1-2',
        'NGSS.5-PS1-3',
        'NGSS.5-PS1-4',
        'NGSS.5-LS1-1',
        'NGSS.5-LS2-1',
        'NGSS.5-ESS1-1',
        'NGSS.5-ESS2-1',
        'NGSS.5-ESS2-2',
        'NGSS.5-ESS3-1',
      ],
      description: 'Grade 5 NGSS matter, ecosystems, Earth systems, and space science.',
      questionTypes: QT.science,
    },
    'Social Studies': {
      topics: [
        'The US Constitution and Bill of Rights',
        'Civil War: Causes, Key Battles, and Outcomes',
        'Reconstruction: Amendments and Freedmen\'s Bureau',
        'Westward Expansion: Manifest Destiny and Trails',
        'Immigration: Ellis Island and Push/Pull Factors',
        'The Industrial Revolution in America',
        'US Geography: Physical Regions and Climate Zones',
        'Economics: Market Economy, Supply and Demand',
      ],
      standards: [
        'C3.D2.His.1.3-5',
        'C3.D2.His.3.3-5',
        'C3.D2.His.5.3-5',
        'C3.D2.Geo.1.3-5',
        'C3.D2.Civ.5.3-5',
        'C3.D2.Civ.6.3-5',
        'C3.D2.Eco.3.3-5',
        'C3.D2.Eco.5.3-5',
      ],
      description: 'Grade 5 US history from Civil War through Reconstruction and westward expansion.',
      questionTypes: QT.socStudies,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GRADE 6
  // ══════════════════════════════════════════════════════════════════════════
  6: {
    Math: {
      topics: [
        'Ratios and Unit Rates',
        'Proportional Reasoning',
        'Percentages: Finding Part, Whole, and Percent',
        'The Number System: Integers and the Number Line',
        'Operations with Integers',
        'Expressions: Writing and Evaluating',
        'One-Step Equations',
        'Area of Polygons and Composite Figures',
        'Surface Area of 3D Figures',
        'Statistics: Mean, Median, Mode, Range, and MAD',
      ],
      standards: [
        'CCSS.MATH.CONTENT.6.RP.A.1',
        'CCSS.MATH.CONTENT.6.RP.A.3',
        'CCSS.MATH.CONTENT.6.NS.A.1',
        'CCSS.MATH.CONTENT.6.NS.B.4',
        'CCSS.MATH.CONTENT.6.NS.C.5',
        'CCSS.MATH.CONTENT.6.NS.C.6',
        'CCSS.MATH.CONTENT.6.EE.A.1',
        'CCSS.MATH.CONTENT.6.EE.B.5',
        'CCSS.MATH.CONTENT.6.G.A.1',
        'CCSS.MATH.CONTENT.6.SP.A.2',
      ],
      description: 'Grade 6 ratios, integers, expressions, equations, geometry, and statistics.',
      questionTypes: QT.mathMid,
    },
    ELA: {
      topics: [
        'Narrative Writing: Plot Structure and Characterization',
        'Informational Writing: Multi-Paragraph Essays',
        'Argument Writing: Claim, Evidence, and Reasoning',
        'Reading Literature: Analyzing Theme and Character Development',
        'Reading Informational Text: Author\'s Purpose and Perspective',
        'Literary Devices: Alliteration, Onomatopoeia, Hyperbole, Irony',
        'Grammar: Pronouns, Intensive Pronouns, and Pronoun Shifts',
        'Vocabulary: Greek and Latin Roots',
        'Research and Citation: MLA Basics',
        'Reading: Comparing Genres on the Same Theme',
      ],
      standards: [
        'CCSS.ELA-LITERACY.RL.6.1',
        'CCSS.ELA-LITERACY.RL.6.2',
        'CCSS.ELA-LITERACY.RL.6.5',
        'CCSS.ELA-LITERACY.RI.6.1',
        'CCSS.ELA-LITERACY.RI.6.6',
        'CCSS.ELA-LITERACY.W.6.1',
        'CCSS.ELA-LITERACY.W.6.2',
        'CCSS.ELA-LITERACY.W.6.3',
        'CCSS.ELA-LITERACY.L.6.1',
        'CCSS.ELA-LITERACY.L.6.4',
      ],
      description: 'Grade 6 argument writing, literary analysis, literary devices, and grammar.',
      questionTypes: QT.elaMid,
    },
    Science: {
      topics: [
        'Cells: Structure and Function of Plant and Animal Cells',
        'Cell Division: Mitosis Basics',
        'Plate Tectonics: Continental Drift and Seafloor Spreading',
        'Earthquakes and Volcanoes',
        'Weather Systems: Fronts, Pressure, and Storms',
        'Earth\'s Oceans: Currents and the Water Cycle',
        'Ecosystems: Biodiversity and Interdependence',
        'Matter: Atoms, Elements, and the Periodic Table (Introduction)',
        'Physical vs Chemical Properties of Matter',
        'Energy Resources: Renewable and Nonrenewable',
      ],
      standards: [
        'NGSS.MS-LS1-1',
        'NGSS.MS-LS1-2',
        'NGSS.MS-LS1-4',
        'NGSS.MS-ESS2-1',
        'NGSS.MS-ESS2-2',
        'NGSS.MS-ESS2-5',
        'NGSS.MS-ESS2-6',
        'NGSS.MS-ESS3-1',
        'NGSS.MS-PS1-1',
        'NGSS.MS-PS1-3',
      ],
      description: 'Grade 6 cells, plate tectonics, weather, ecosystems, and matter.',
      questionTypes: QT.science,
    },
    'Social Studies': {
      topics: [
        'World Geography: Continents, Oceans, and Regions',
        'Ancient Mesopotamia: Sumer, Babylon, and Persia',
        'Ancient Egypt: Civilization, Pharaohs, and Legacy',
        'Ancient India: Indus Valley and Vedic Civilization',
        'Ancient China: Dynasties and the Silk Road',
        'Ancient Greece: Democracy, Philosophy, and Mythology',
        'Ancient Rome: Republic, Empire, and Fall',
        'World Religions: Judaism, Hinduism, Buddhism, Christianity, Islam',
        'Trade Routes and the Spread of Culture',
        'Geography: How Environment Shapes Civilization',
      ],
      standards: [
        'C3.D2.His.1.6-8',
        'C3.D2.His.2.6-8',
        'C3.D2.His.4.6-8',
        'C3.D2.Geo.1.6-8',
        'C3.D2.Geo.3.6-8',
        'C3.D2.Civ.1.6-8',
        'C3.D2.Eco.1.6-8',
      ],
      description: 'Grade 6 ancient world civilizations, world religions, and geography.',
      questionTypes: QT.socStudies,
    },
    Health: {
      topics: [
        'Nutrition: MyPlate, Macronutrients, and Food Labels',
        'Physical Fitness: Components and Benefits',
        'Mental Health: Emotions, Stress, and Coping Strategies',
        'Puberty and Adolescent Physical Development',
        'Substance Abuse Prevention: Tobacco and Vaping',
        'Personal Safety and Healthy Boundaries',
        'Disease Prevention: Immune System Basics and Hygiene',
        'Media Literacy and Body Image',
      ],
      standards: [
        'NHES.1.8',
        'NHES.2.8',
        'NHES.3.8',
        'NHES.5.8',
        'NHES.7.8',
      ],
      description: 'Grade 6 adolescent health: nutrition, fitness, puberty, mental health, and prevention.',
      questionTypes: QT.health,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GRADE 7
  // ══════════════════════════════════════════════════════════════════════════
  7: {
    Math: {
      topics: [
        'Proportional Relationships and Unit Rates',
        'Operations with Rational Numbers: Integers and Fractions',
        'Operations with Rational Numbers: Decimals',
        'Two-Step Equations and Inequalities',
        'Scale Drawings and Geometric Scale Factor',
        'Circles: Circumference and Area',
        'Angle Relationships: Supplementary, Complementary, and Vertical',
        'Surface Area and Volume of 3D Figures',
        'Probability: Simple and Compound Events',
        'Statistics: Sampling and Drawing Inferences',
      ],
      standards: [
        'CCSS.MATH.CONTENT.7.RP.A.1',
        'CCSS.MATH.CONTENT.7.RP.A.2',
        'CCSS.MATH.CONTENT.7.NS.A.1',
        'CCSS.MATH.CONTENT.7.NS.A.2',
        'CCSS.MATH.CONTENT.7.EE.A.1',
        'CCSS.MATH.CONTENT.7.EE.B.4',
        'CCSS.MATH.CONTENT.7.G.A.1',
        'CCSS.MATH.CONTENT.7.G.B.4',
        'CCSS.MATH.CONTENT.7.G.B.6',
        'CCSS.MATH.CONTENT.7.SP.C.5',
      ],
      description: 'Grade 7 rational numbers, proportional relationships, geometry, and probability.',
      questionTypes: QT.mathMid,
    },
    ELA: {
      topics: [
        'Argument Essay: Claim, Counterclaim, and Evidence',
        'Literary Analysis: Theme, Tone, and Mood',
        'Literary Devices: Symbolism, Allegory, and Irony',
        'Reading Informational Text: Analyzing Arguments',
        'Research Writing: Evaluating and Citing Sources (MLA)',
        'Grammar: Phrases, Clauses, and Sentence Variety',
        'Vocabulary: Academic Word List and Context',
        'Poetry Analysis: Speaker, Form, and Figurative Language',
        'Narrative Writing: Plot Development and Conflict',
        'Media Literacy: Analyzing Purpose and Bias',
      ],
      standards: [
        'CCSS.ELA-LITERACY.RL.7.1',
        'CCSS.ELA-LITERACY.RL.7.2',
        'CCSS.ELA-LITERACY.RL.7.4',
        'CCSS.ELA-LITERACY.RI.7.1',
        'CCSS.ELA-LITERACY.RI.7.5',
        'CCSS.ELA-LITERACY.RI.7.8',
        'CCSS.ELA-LITERACY.W.7.1',
        'CCSS.ELA-LITERACY.W.7.2',
        'CCSS.ELA-LITERACY.L.7.1',
        'CCSS.ELA-LITERACY.L.7.4',
      ],
      description: 'Grade 7 argument writing, literary devices, informational reading, and grammar.',
      questionTypes: QT.elaMid,
    },
    Science: {
      topics: [
        'Cell Division: Mitosis and Meiosis',
        'Genetics: DNA, Genes, and Chromosomes',
        'Heredity: Dominant and Recessive Traits',
        'Punnett Squares and Probability of Traits',
        'Evolution: Natural Selection and Adaptation',
        'Evidence of Evolution: Fossils and Comparative Anatomy',
        'Human Body: Organ Systems and Their Functions',
        'Reproduction: Asexual and Sexual',
        'Earth\'s History: Geologic Time Scale',
        'Rock Cycle: Igneous, Sedimentary, and Metamorphic Rocks',
      ],
      standards: [
        'NGSS.MS-LS1-4',
        'NGSS.MS-LS1-5',
        'NGSS.MS-LS3-1',
        'NGSS.MS-LS3-2',
        'NGSS.MS-LS4-1',
        'NGSS.MS-LS4-2',
        'NGSS.MS-LS4-4',
        'NGSS.MS-LS4-6',
        'NGSS.MS-ESS1-4',
        'NGSS.MS-PS2-4',
      ],
      description: 'Grade 7 cell division, genetics, evolution, body systems, and Earth history.',
      questionTypes: QT.science,
    },
    'Social Studies': {
      topics: [
        'The Middle Ages: Feudalism and the Catholic Church',
        'The Byzantine Empire and Eastern Christianity',
        'The Islamic Golden Age and Expansion',
        'African Kingdoms: Mali, Ghana, and Songhai',
        'Asian Empires: Mongols, Tang, and Song China',
        'The Renaissance: Art, Science, and Humanism',
        'The Reformation: Protestant Movement and its Effects',
        'Age of Exploration: Motives, Routes, and Consequences',
        'Aztec and Inca Civilizations',
        'Columbian Exchange: Causes and Global Impact',
      ],
      standards: [
        'C3.D2.His.1.6-8',
        'C3.D2.His.2.6-8',
        'C3.D2.His.3.6-8',
        'C3.D2.His.4.6-8',
        'C3.D2.Geo.1.6-8',
        'C3.D2.Geo.4.6-8',
        'C3.D2.Civ.2.6-8',
        'C3.D2.Eco.1.6-8',
      ],
      description: 'Grade 7 Medieval, Renaissance, Reformation, and early global exploration world history.',
      questionTypes: QT.socStudies,
    },
    Health: {
      topics: [
        'Mental Health: Anxiety, Stress Management, and Resilience',
        'Healthy Relationships: Communication and Respect',
        'Recognizing Peer Pressure and Refusal Skills',
        'Tobacco, Alcohol, and Drug Prevention',
        'Reproductive Health: Puberty and Anatomy',
        'STI Awareness and Prevention (Age-Appropriate)',
        'First Aid: CPR Basics and Emergency Response',
        'Nutrition: Calories, Portion Control, and Eating Disorders',
      ],
      standards: [
        'NHES.1.8',
        'NHES.2.8',
        'NHES.4.8',
        'NHES.5.8',
        'NHES.7.8',
        'NHES.8.8',
      ],
      description: 'Grade 7 mental health, substance prevention, relationships, and reproductive health.',
      questionTypes: QT.health,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GRADE 8
  // ══════════════════════════════════════════════════════════════════════════
  8: {
    Math: {
      topics: [
        'Properties of Exponents and Scientific Notation',
        'Square Roots and Cube Roots',
        'Proportional vs Non-Proportional Relationships',
        'Slope: Definition, Rate of Change, and Graphing',
        'Linear Equations: One Variable',
        'Systems of Linear Equations: Graphing and Substitution',
        'Functions: Definition, Notation, and Linear vs Nonlinear',
        'Pythagorean Theorem and Its Converse',
        'Volume of Cylinders, Cones, and Spheres',
        'Bivariate Data: Scatter Plots and Lines of Best Fit',
      ],
      standards: [
        'CCSS.MATH.CONTENT.8.NS.A.1',
        'CCSS.MATH.CONTENT.8.EE.A.1',
        'CCSS.MATH.CONTENT.8.EE.B.5',
        'CCSS.MATH.CONTENT.8.EE.C.7',
        'CCSS.MATH.CONTENT.8.EE.C.8',
        'CCSS.MATH.CONTENT.8.F.A.1',
        'CCSS.MATH.CONTENT.8.F.B.4',
        'CCSS.MATH.CONTENT.8.G.B.7',
        'CCSS.MATH.CONTENT.8.G.C.9',
        'CCSS.MATH.CONTENT.8.SP.A.1',
      ],
      description: 'Grade 8 linear relationships, exponents, Pythagorean theorem, and functions.',
      questionTypes: QT.mathMid,
    },
    ELA: {
      topics: [
        'Argumentative Essay: Claim, Evidence, Counterclaim, and Rebuttal',
        'Analyzing Author\'s Argument: Reasoning, Evidence, and Rhetoric',
        'Literary Analysis: Complex Themes and Ambiguity',
        'Reading Informational Text: Synthesizing Multiple Sources',
        'Research Paper: MLA Formatting and Citation',
        'Grammar: Conventions, Style, and Formal vs Informal Register',
        'Vocabulary: Connotation, Denotation, and Nuance',
        'Narrative Writing: Perspective, Pacing, and Tension',
        'Media Literacy: Evaluating Claims and Detecting Bias',
        'Seminal US Texts: Analyzing Historical Documents',
      ],
      standards: [
        'CCSS.ELA-LITERACY.RL.8.1',
        'CCSS.ELA-LITERACY.RL.8.2',
        'CCSS.ELA-LITERACY.RL.8.6',
        'CCSS.ELA-LITERACY.RI.8.1',
        'CCSS.ELA-LITERACY.RI.8.6',
        'CCSS.ELA-LITERACY.RI.8.8',
        'CCSS.ELA-LITERACY.W.8.1',
        'CCSS.ELA-LITERACY.W.8.2',
        'CCSS.ELA-LITERACY.L.8.1',
        'CCSS.ELA-LITERACY.L.8.3',
      ],
      description: 'Grade 8 advanced argument writing, rhetoric, seminal texts, and complex literary analysis.',
      questionTypes: QT.elaMid,
    },
    Science: {
      topics: [
        'Force, Mass, and Newton\'s Three Laws of Motion',
        'Momentum and Collisions',
        'Wave Properties: Amplitude, Wavelength, and Frequency',
        'The Electromagnetic Spectrum',
        'Sound Waves: Transmission and the Ear',
        'Light: Reflection, Refraction, and Lenses',
        'Chemical Reactions: Reactants, Products, and Balancing Equations',
        'Conservation of Matter in Chemical Reactions',
        'Climate Change: Evidence, Causes, and Feedback Loops',
        'Human Impact on the Environment and Sustainability',
      ],
      standards: [
        'NGSS.MS-PS2-1',
        'NGSS.MS-PS2-2',
        'NGSS.MS-PS2-3',
        'NGSS.MS-PS4-1',
        'NGSS.MS-PS4-2',
        'NGSS.MS-PS4-3',
        'NGSS.MS-PS1-2',
        'NGSS.MS-PS1-5',
        'NGSS.MS-ESS3-3',
        'NGSS.MS-ESS3-5',
      ],
      description: 'Grade 8 physics (forces, waves), chemistry (reactions), and environmental science.',
      questionTypes: QT.science,
    },
    'Social Studies': {
      topics: [
        'The Industrial Revolution: Causes, Innovations, and Social Effects',
        'Reconstruction: Successes, Failures, and Jim Crow Laws',
        'Immigration and Urbanization (1870s–1920s)',
        'The Progressive Era: Reform Movements and Key Figures',
        'The Gilded Age: Robber Barons and Labor Movements',
        'Manifest Destiny: Expansion, Conflict, and Native Americans',
        'The Spanish-American War and US Imperialism',
        'World War I: Causes, US Entry, and Treaty of Versailles',
        'The Roaring Twenties and the Great Depression',
        'The New Deal: Government\'s Role in the Economy',
      ],
      standards: [
        'C3.D2.His.1.6-8',
        'C3.D2.His.2.6-8',
        'C3.D2.His.3.6-8',
        'C3.D2.His.5.6-8',
        'C3.D2.Geo.1.6-8',
        'C3.D2.Civ.1.6-8',
        'C3.D2.Civ.6.6-8',
        'C3.D2.Eco.1.6-8',
      ],
      description: 'Grade 8 US history from Reconstruction through WWI and the Great Depression.',
      questionTypes: QT.socStudies,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GRADE 9
  // ══════════════════════════════════════════════════════════════════════════
  9: {
    Math: {
      topics: [
        'Algebra I: Properties and Simplifying Expressions',
        'Algebra I: Solving One- and Two-Step Equations',
        'Algebra I: Multi-Step and Literal Equations',
        'Algebra I: Linear Inequalities and Graphing',
        'Algebra I: Systems of Equations (Graphing, Substitution, Elimination)',
        'Algebra I: Polynomials: Adding, Subtracting, and Multiplying',
        'Algebra I: Factoring Polynomials',
        'Algebra I: Quadratic Equations (Standard Form and Factoring)',
        'Algebra I: Functions, Domain, and Range',
        'Geometry: Points, Lines, Planes, Angles, and Proofs',
      ],
      standards: [
        'CCSS.MATH.CONTENT.HSA.SSE.A.1',
        'CCSS.MATH.CONTENT.HSA.CED.A.1',
        'CCSS.MATH.CONTENT.HSA.REI.B.3',
        'CCSS.MATH.CONTENT.HSA.REI.C.6',
        'CCSS.MATH.CONTENT.HSA.REI.D.10',
        'CCSS.MATH.CONTENT.HSA.APR.A.1',
        'CCSS.MATH.CONTENT.HSF.IF.A.1',
        'CCSS.MATH.CONTENT.HSF.IF.B.4',
        'CCSS.MATH.CONTENT.HSG.CO.A.1',
        'CCSS.MATH.CONTENT.HSG.CO.C.9',
      ],
      description: 'Grade 9 Algebra I foundations and introduction to Geometry proofs.',
      questionTypes: QT.mathHS,
    },
    ELA: {
      topics: [
        'American Literature: Short Stories and the American Dream',
        'American Literature: Poetry (Whitman, Dickinson, Frost)',
        'Expository Writing: Thesis Development and Essay Structure',
        'Persuasive Writing: Rhetorical Appeals (Ethos, Pathos, Logos)',
        'Reading: Analyzing Rhetoric in Historical Speeches',
        'Literary Analysis: Characterization, Conflict, and Symbol',
        'Grammar: Conventions, Style, and Voice',
        'Vocabulary: SAT High-Frequency Words in Context',
        'Research Paper: Annotated Bibliography and MLA Citation',
        'Reading Informational Text: Evaluating Sources and Bias',
      ],
      standards: [
        'CCSS.ELA-LITERACY.RL.9-10.1',
        'CCSS.ELA-LITERACY.RL.9-10.2',
        'CCSS.ELA-LITERACY.RL.9-10.4',
        'CCSS.ELA-LITERACY.RI.9-10.1',
        'CCSS.ELA-LITERACY.RI.9-10.6',
        'CCSS.ELA-LITERACY.RI.9-10.8',
        'CCSS.ELA-LITERACY.W.9-10.1',
        'CCSS.ELA-LITERACY.W.9-10.2',
        'CCSS.ELA-LITERACY.L.9-10.1',
        'CCSS.ELA-LITERACY.L.9-10.3',
      ],
      description: 'Grade 9 American literature, rhetoric, expository/persuasive writing, and SAT vocabulary.',
      questionTypes: QT.elaHS,
    },
    Science: {
      topics: [
        'Biology: Cell Theory and Types of Cells',
        'Biology: Cell Organelles and Their Functions',
        'Biology: Cell Membrane and Transport (Osmosis, Diffusion)',
        'Biology: Photosynthesis and Cellular Respiration',
        'Biology: Mitosis and the Cell Cycle',
        'Biology: Meiosis and Genetic Variation',
        'Biology: Mendelian Genetics and Punnett Squares',
        'Biology: DNA Structure and Replication',
        'Biology: Protein Synthesis (Transcription and Translation)',
        'Biology: Evolution: Evidence, Natural Selection, and Speciation',
      ],
      standards: [
        'NGSS.HS-LS1-1',
        'NGSS.HS-LS1-2',
        'NGSS.HS-LS1-5',
        'NGSS.HS-LS1-6',
        'NGSS.HS-LS1-7',
        'NGSS.HS-LS2-1',
        'NGSS.HS-LS3-1',
        'NGSS.HS-LS3-2',
        'NGSS.HS-LS4-1',
        'NGSS.HS-LS4-2',
      ],
      description: 'Grade 9 Biology: cells, genetics, DNA, evolution, and photosynthesis.',
      questionTypes: QT.science,
    },
    'Social Studies': {
      topics: [
        'World History: World War I — Causes and Alliances',
        'World History: The Russian Revolution and the Rise of Communism',
        'World History: The Rise of Fascism and Nazism',
        'World History: World War II — Causes, Theater, and Holocaust',
        'World History: The Cold War — Origins and Proxy Wars',
        'World History: Decolonization in Africa and Asia',
        'World History: The Korean War and Vietnam War',
        'World History: The Space Race and Nuclear Arms Race',
        'Geography: Political and Economic Systems Around the World',
        'Human Rights: Universal Declaration and Modern Struggles',
      ],
      standards: [
        'C3.D2.His.1.9-12',
        'C3.D2.His.2.9-12',
        'C3.D2.His.3.9-12',
        'C3.D2.His.5.9-12',
        'C3.D2.Geo.1.9-12',
        'C3.D2.Civ.1.9-12',
        'C3.D2.Civ.6.9-12',
        'C3.D2.Eco.1.9-12',
      ],
      description: 'Grade 9 modern world history: WWI, WWII, Cold War, and decolonization.',
      questionTypes: QT.socStudies,
    },
    Health: {
      topics: [
        'Mental Health: Depression, Anxiety, and Seeking Help',
        'Suicide Prevention and Crisis Resources',
        'Healthy Relationships, Consent, and Boundaries',
        'Sexual Health: Contraception and STI Prevention',
        'Substance Abuse: Understanding Addiction and Recovery',
        'Nutrition: Macronutrients, Micronutrients, and Metabolism',
        'Fitness: FITT Principle and Personalized Fitness Plans',
        'Environmental Health: Toxins, Pollutants, and Advocacy',
      ],
      standards: [
        'NHES.1.12',
        'NHES.2.12',
        'NHES.4.12',
        'NHES.5.12',
        'NHES.6.12',
        'NHES.7.12',
        'NHES.8.12',
      ],
      description: 'Grade 9 advanced health: mental health, relationships, sexual health, and substance prevention.',
      questionTypes: QT.health,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GRADE 10
  // ══════════════════════════════════════════════════════════════════════════
  10: {
    Math: {
      topics: [
        'Algebra II: Complex Numbers and Operations',
        'Algebra II: Solving Quadratic Equations (Quadratic Formula, Completing the Square)',
        'Algebra II: Polynomial Functions and Graphs',
        'Algebra II: Rational Expressions and Equations',
        'Algebra II: Radical Expressions and Equations',
        'Algebra II: Exponential and Logarithmic Functions',
        'Algebra II: Sequences and Series (Arithmetic and Geometric)',
        'Geometry: Similarity, Congruence, and Triangle Proofs',
        'Geometry: Right Triangle Trigonometry (SOH-CAH-TOA)',
        'Statistics: Normal Distribution, Z-Scores, and Probability',
      ],
      standards: [
        'CCSS.MATH.CONTENT.HSA.REI.B.4',
        'CCSS.MATH.CONTENT.HSA.APR.B.3',
        'CCSS.MATH.CONTENT.HSA.APR.D.6',
        'CCSS.MATH.CONTENT.HSF.BF.A.2',
        'CCSS.MATH.CONTENT.HSF.LE.A.1',
        'CCSS.MATH.CONTENT.HSF.LE.A.2',
        'CCSS.MATH.CONTENT.HSG.SRT.A.1',
        'CCSS.MATH.CONTENT.HSG.SRT.C.6',
        'CCSS.MATH.CONTENT.HSG.CO.B.7',
        'CCSS.MATH.CONTENT.HSS.ID.A.4',
      ],
      description: 'Grade 10 Algebra II functions, logarithms, and Geometry proofs with trigonometry.',
      questionTypes: QT.mathHS,
    },
    ELA: {
      topics: [
        'World Literature: Latin American Magical Realism',
        'World Literature: Postcolonial African and Asian Voices',
        'World Literature: European Literary Movements (Realism, Modernism)',
        'Advanced Composition: Research Paper with Chicago/MLA Style',
        'Analytical Writing: Literary Criticism and Theory',
        'Rhetoric and Argumentation: Analyzing Political and Historical Speeches',
        'Reading: Comparing World Texts Across Cultures',
        'Vocabulary: Advanced Academic and Discipline-Specific Words',
        'Grammar: Syntax, Diction, and Style in Professional Writing',
        'Media and Digital Literacy: Evaluating Online Sources and Propaganda',
      ],
      standards: [
        'CCSS.ELA-LITERACY.RL.9-10.1',
        'CCSS.ELA-LITERACY.RL.9-10.6',
        'CCSS.ELA-LITERACY.RL.9-10.9',
        'CCSS.ELA-LITERACY.RI.9-10.1',
        'CCSS.ELA-LITERACY.RI.9-10.8',
        'CCSS.ELA-LITERACY.RI.9-10.9',
        'CCSS.ELA-LITERACY.W.9-10.1',
        'CCSS.ELA-LITERACY.W.9-10.7',
        'CCSS.ELA-LITERACY.L.9-10.1',
        'CCSS.ELA-LITERACY.L.9-10.3',
      ],
      description: 'Grade 10 world literature, advanced research writing, literary criticism, and rhetoric.',
      questionTypes: QT.elaHS,
    },
    Science: {
      topics: [
        'Chemistry: Atomic Structure, Electron Configuration, and Periodic Trends',
        'Chemistry: The Periodic Table: Groups, Periods, and Properties',
        'Chemistry: Chemical Bonding: Ionic, Covalent, and Metallic',
        'Chemistry: Naming Compounds and Writing Chemical Formulas',
        'Chemistry: Chemical Reactions: Types and Balancing Equations',
        'Chemistry: Stoichiometry: Mole Ratios and Limiting Reagents',
        'Chemistry: States of Matter, Gas Laws, and Kinetic Molecular Theory',
        'Chemistry: Acids, Bases, and pH',
        'Physics: Kinematics: Motion, Velocity, and Acceleration',
        'Physics: Newton\'s Laws Applied: Forces, Friction, and Free Body Diagrams',
      ],
      standards: [
        'NGSS.HS-PS1-1',
        'NGSS.HS-PS1-2',
        'NGSS.HS-PS1-3',
        'NGSS.HS-PS1-4',
        'NGSS.HS-PS1-5',
        'NGSS.HS-PS1-6',
        'NGSS.HS-PS1-7',
        'NGSS.HS-PS2-1',
        'NGSS.HS-PS2-2',
        'NGSS.HS-PS3-1',
      ],
      description: 'Grade 10 Chemistry (atomic structure to stoichiometry) and Physics kinematics.',
      questionTypes: QT.science,
    },
    'Social Studies': {
      topics: [
        'US Government: Constitutional Principles and Federalism',
        'US Government: The Bill of Rights and Civil Liberties',
        'US Government: The Three Branches and Checks and Balances',
        'US Government: The Legislative Process and Congress',
        'US Government: The Electoral College and Voting Rights',
        'US History: Civil Rights Movement — Leaders and Legislation',
        'US History: Vietnam War and Anti-War Movement',
        'US History: The Cold War at Home — McCarthyism and Space Race',
        'US History: Modern America (1980s–Present)',
        'Economics: Fiscal Policy, Monetary Policy, and the Federal Reserve',
      ],
      standards: [
        'C3.D2.His.1.9-12',
        'C3.D2.His.3.9-12',
        'C3.D2.His.5.9-12',
        'C3.D2.Geo.1.9-12',
        'C3.D2.Civ.1.9-12',
        'C3.D2.Civ.5.9-12',
        'C3.D2.Civ.8.9-12',
        'C3.D2.Eco.3.9-12',
        'C3.D2.Eco.5.9-12',
      ],
      description: 'Grade 10 US Government structure, civil rights history, and macroeconomics.',
      questionTypes: QT.socStudies,
    },
  },

};

// ─── Query Helpers ────────────────────────────────────────────────────────────

/**
 * Returns available subjects for a given grade
 * @param {number} grade - Grade level 1–10
 * @returns {string[]} Subject names available at that grade
 */
export function getSubjectsForGrade(grade) {
  return Object.keys(CURRICULUM[grade] || {});
}

/**
 * Returns available topics for a given grade and subject
 * @param {number} grade - Grade level 1–10
 * @param {string} subject - Subject name
 * @returns {string[]} Topic strings for that grade/subject
 */
export function getTopicsForGradeSubject(grade, subject) {
  return CURRICULUM[grade]?.[subject]?.topics ?? [];
}

/**
 * Returns the CCSS/NGSS/NHES standard codes for a given grade and subject
 * @param {number} grade - Grade level 1–10
 * @param {string} subject - Subject name
 * @returns {string[]} Standard code strings
 */
export function getStandardsForGradeSubject(grade, subject) {
  return CURRICULUM[grade]?.[subject]?.standards ?? [];
}

/**
 * Returns the recommended question types for a given grade and subject
 * @param {number} grade - Grade level 1–10
 * @param {string} subject - Subject name
 * @returns {string[]} Question type strings
 */
export function getQuestionTypesForGradeSubject(grade, subject) {
  return CURRICULUM[grade]?.[subject]?.questionTypes ?? [
    'multiple-choice', 'short-answer', 'fill-in-the-blank',
  ];
}

/**
 * Returns a human-readable description for a given grade and subject
 * @param {number} grade - Grade level 1–10
 * @param {string} subject - Subject name
 * @returns {string} Description string
 */
export function getDescriptionForGradeSubject(grade, subject) {
  return CURRICULUM[grade]?.[subject]?.description ?? '';
}

/**
 * Returns all valid grade numbers
 * @returns {number[]}
 */
export function getAllGrades() {
  return Object.keys(CURRICULUM).map(Number);
}

/**
 * Returns a flat array of all {grade, subject, topic} combinations (useful for batch validation)
 * @returns {Array<{grade: number, subject: string, topic: string}>}
 */
export function getAllTopicCombinations() {
  const result = [];
  for (const grade of getAllGrades()) {
    for (const subject of getSubjectsForGrade(grade)) {
      for (const topic of getTopicsForGradeSubject(grade, subject)) {
        result.push({ grade, subject, topic });
      }
    }
  }
  return result;
}
