/**
 * @file frontend/js/app.js
 * @description Learnfyra — single-page worksheet generator frontend.
 *
 * Responsibilities:
 *  - Populates Grade / Subject / Topic dropdowns from embedded curriculum data
 *  - Validates form fields and enables/disables the Generate button
 *  - POSTs to /api/generate and handles success / error states
 *  - Calls GET /api/download?key=<S3_KEY> to obtain presigned URLs
 */

'use strict';

/* =============================================================
   Curriculum Data (embedded — no API call needed)
   ============================================================= */
const CURRICULUM = {
  1: {
    Math: { topics: ['Counting and Cardinality (0–120)','Addition within 20','Subtraction within 20','Place Value: Tens and Ones','Comparing Two-Digit Numbers','Measurement: Length and Time','2D and 3D Shapes','Organizing and Interpreting Data','Addition and Subtraction Word Problems','Even and Odd Numbers'] },
    ELA: { topics: ['Phonics: Short and Long Vowel Patterns','Sight Words (Dolch Pre-Primer through Grade 1)','Reading Comprehension: Main Idea and Key Details','Reading Informational Texts','Writing: Complete Sentences and Labels','Capitalization and End Punctuation','Nouns and Verbs (Introduction)','Vocabulary: Words from Illustrations and Context','Retelling Stories with Key Details','Rhyme, Alliteration, and Word Families'] },
    Science: { topics: ['Living vs Nonliving Things','Plant Structures and What Plants Need','Animal Habitats and Survival Needs','Sunlight, Warmth, and Plant Growth','Seasonal Changes on Earth','Sound: Vibration and Volume','Light: Sources, Shadows, and Reflection','Patterns in the Sky: Sun, Moon, Stars'] },
    'Social Studies': { topics: ['Family Structures and Community Roles','Rules, Laws, and Why They Matter','Map Skills: Cardinal Directions and Map Symbols','US Symbols: Flag, Pledge, National Monuments','National Holidays and Their Meaning','Needs vs Wants: Basic Economic Concepts','Timelines: Past, Present, and Future','Contributions of Historical Figures (Lincoln, MLK Jr.)'] },
  },
  2: {
    Math: { topics: ['Place Value to 1,000','Addition and Subtraction within 1,000','Skip Counting: 2s, 5s, 10s, 100s','Measurement: Inches, Feet, Centimeters, Meters','Telling Time to the Nearest 5 Minutes','Money: Counting Coins and Bills','Basic Fractions: Halves, Thirds, Fourths','Bar Graphs, Pictographs, and Line Plots','Even and Odd Numbers','Addition and Subtraction Word Problems'] },
    ELA: { topics: ['Phonics: Blends, Digraphs, and Vowel Teams','Reading Comprehension: Main Idea and Supporting Details','Reading Comprehension: Cause and Effect','Story Elements: Character, Setting, Problem, Solution','Writing: Opinion Paragraphs','Writing: Informational Paragraphs','Nouns: Common, Proper, Plural, and Possessive','Verbs: Action, Linking, and Helping Verbs','Adjectives and Adverbs','Vocabulary: Compound Words, Contractions, and Synonyms'] },
    Science: { topics: ['Properties of Matter: Solids, Liquids, and Gases','Changing Matter: Heating and Cooling','Plant Life Cycles','Animal Life Cycles and Diversity','Earth\'s Materials: Rocks, Soil, and Fossils','Landforms and Bodies of Water','Weather: Measurement and Patterns','How Maps Show Land and Water'] },
    'Social Studies': { topics: ['Maps: Continents, Oceans, Countries, and States','Economics: Goods, Services, Producers, and Consumers','How Communities Change Over Time','Famous Americans and Their Contributions','Native American Peoples and Cultures','Government: Local, State, and National','Immigration and the American Story','Geography: Using Maps and Globes'] },
  },
  3: {
    Math: { topics: ['Multiplication Facts (1–10)','Division: Equal Groups and Arrays','Relationship Between Multiplication and Division','Fractions: Understanding Unit Fractions','Fractions on a Number Line','Area of Rectangles','Perimeter','Multi-Digit Addition and Subtraction','Rounding to Nearest 10 and 100','Elapsed Time and Telling Time'] },
    ELA: { topics: ['Reading Comprehension: Asking and Answering Questions','Reading Comprehension: Inference and Evidence','Story Elements: Theme, Moral, and Point of View','Informational Text: Main Idea and Key Details','Paragraph Writing: Topic, Detail, Conclusion','Narrative Writing','Opinion Writing with Reasons and Evidence','Grammar: Nouns, Verbs, Adjectives, and Adverbs','Prefixes and Suffixes','Vocabulary: Context Clues and Dictionary Skills'] },
    Science: { topics: ['Life Cycles of Plants','Life Cycles of Animals','Inheritance: Traits from Parents to Offspring','Adaptations: How Organisms Survive','Ecosystems and Food Chains','Fossils as Evidence of Past Life','Forces: Pushes and Pulls','Magnets and Magnetic Forces','Weather, Climate, and Severe Weather Preparedness','Conservation of Natural Resources'] },
    'Social Studies': { topics: ['US Geography: Five Regions','Physical and Political Maps','Native American Peoples: Regions and Cultures','Colonial America: The 13 Colonies','American Revolution: Causes and Key Events','US Government: Three Branches','Economics: Supply, Demand, and Trade','Community: Then and Now'] },
  },
  4: {
    Math: { topics: ['Multi-Digit Multiplication (up to 4 digits)','Long Division with Remainders','Factors, Multiples, Prime, and Composite Numbers','Equivalent Fractions','Comparing and Ordering Fractions','Adding and Subtracting Fractions with Like Denominators','Decimals: Tenths and Hundredths','Comparing Decimals','Angles and Angle Measurement','Symmetry, Lines, and Properties of Shapes'] },
    ELA: { topics: ['Reading Comprehension: Theme and Summary','Reading Comprehension: Text Structure (Cause/Effect, Compare/Contrast)','Figurative Language: Simile, Metaphor, Personification, Idiom','Reading Informational Text: Main Idea and Details','Opinion Essay Writing','Informational Essay Writing','Narrative Writing with Dialogue and Description','Grammar: Pronouns, Conjunctions, and Prepositions','Vocabulary: Context Clues and Multiple-Meaning Words','Research Skills: Finding and Using Sources'] },
    Science: { topics: ['Energy: Forms, Transfer, and Conservation','Electricity and Circuits','Waves: Properties of Sound and Light','Plant and Animal Structures and Functions','Internal and External Structures for Survival','Animal Communication and Behavior','Earth\'s Landforms: Erosion, Weathering, and Deposition','Natural Disasters: Earthquakes, Volcanoes, and Floods','Earth\'s Water Cycle','Human Impact on Earth\'s Resources'] },
    'Social Studies': { topics: ['US States, Capitals, and Regional Geography','Colonial America: Life, Government, and Economy','American Revolution: Causes, Events, and Key Figures','Declaration of Independence','Early US Government: Articles of Confederation to Constitution','Branches of Government and Checks and Balances','Westward Expansion: Louisiana Purchase and Lewis and Clark','Economics: Opportunity Cost, Scarcity, and Resources'] },
  },
  5: {
    Math: { topics: ['Order of Operations (PEMDAS)','Place Value: Decimals to Thousandths','Adding and Subtracting Decimals','Multiplying Decimals','Dividing Decimals','Adding and Subtracting Fractions with Unlike Denominators','Multiplying Fractions and Mixed Numbers','Dividing Unit Fractions by Whole Numbers','Volume of Rectangular Prisms','Coordinate Planes: Graphing Points'] },
    ELA: { topics: ['Literary Analysis: Theme, Conflict, and Resolution','Poetry: Figurative Language and Structure','Reading Comprehension: Point of View and Perspective','Informational Text: Summarizing Complex Articles','Compare and Contrast: Two Texts on the Same Topic','Opinion Writing with Evidence from Multiple Sources','Research Report Writing','Narrative Writing: Dialogue, Pacing, and Sensory Details','Grammar: Verb Tense, Modifiers, and Sentence Types','Vocabulary: Greek and Latin Roots (Introduction)'] },
    Science: { topics: ['Matter: Properties and States','Physical and Chemical Changes of Matter','Mixtures and Solutions','Ecosystems: Energy Flow and Food Webs','Earth\'s Systems: Geosphere, Hydrosphere, Atmosphere, Biosphere','Earth\'s Water Cycle and Weather','Earth in the Solar System: Seasons and Day/Night','Space: Stars, Planets, and the Moon','Human Impact on Earth\'s Environment','Conservation and Biodiversity'] },
    'Social Studies': { topics: ['The US Constitution and Bill of Rights','Civil War: Causes, Key Battles, and Outcomes','Reconstruction: Amendments and Freedmen\'s Bureau','Westward Expansion: Manifest Destiny and Trails','Immigration: Ellis Island and Push/Pull Factors','The Industrial Revolution in America','US Geography: Physical Regions and Climate Zones','Economics: Market Economy, Supply and Demand'] },
  },
  6: {
    Math: { topics: ['Ratios and Unit Rates','Proportional Reasoning','Percentages: Finding Part, Whole, and Percent','The Number System: Integers and the Number Line','Operations with Integers','Expressions: Writing and Evaluating','One-Step Equations','Area of Polygons and Composite Figures','Surface Area of 3D Figures','Statistics: Mean, Median, Mode, Range, and MAD'] },
    ELA: { topics: ['Narrative Writing: Plot Structure and Characterization','Informational Writing: Multi-Paragraph Essays','Argument Writing: Claim, Evidence, and Reasoning','Reading Literature: Analyzing Theme and Character Development','Reading Informational Text: Author\'s Purpose and Perspective','Literary Devices: Alliteration, Onomatopoeia, Hyperbole, Irony','Grammar: Pronouns, Intensive Pronouns, and Pronoun Shifts','Vocabulary: Greek and Latin Roots','Research and Citation: MLA Basics','Reading: Comparing Genres on the Same Theme'] },
    Science: { topics: ['Cells: Structure and Function of Plant and Animal Cells','Cell Division: Mitosis Basics','Plate Tectonics: Continental Drift and Seafloor Spreading','Earthquakes and Volcanoes','Weather Systems: Fronts, Pressure, and Storms','Earth\'s Oceans: Currents and the Water Cycle','Ecosystems: Biodiversity and Interdependence','Matter: Atoms, Elements, and the Periodic Table (Introduction)','Physical vs Chemical Properties of Matter','Energy Resources: Renewable and Nonrenewable'] },
    'Social Studies': { topics: ['World Geography: Continents, Oceans, and Regions','Ancient Mesopotamia: Sumer, Babylon, and Persia','Ancient Egypt: Civilization, Pharaohs, and Legacy','Ancient India: Indus Valley and Vedic Civilization','Ancient China: Dynasties and the Silk Road','Ancient Greece: Democracy, Philosophy, and Mythology','Ancient Rome: Republic, Empire, and Fall','World Religions: Judaism, Hinduism, Buddhism, Christianity, Islam','Trade Routes and the Spread of Culture','Geography: How Environment Shapes Civilization'] },
    Health: { topics: ['Nutrition: MyPlate, Macronutrients, and Food Labels','Physical Fitness: Components and Benefits','Mental Health: Emotions, Stress, and Coping Strategies','Puberty and Adolescent Physical Development','Substance Abuse Prevention: Tobacco and Vaping','Personal Safety and Healthy Boundaries','Disease Prevention: Immune System Basics and Hygiene','Media Literacy and Body Image'] },
  },
  7: {
    Math: { topics: ['Proportional Relationships and Unit Rates','Operations with Rational Numbers: Integers and Fractions','Operations with Rational Numbers: Decimals','Two-Step Equations and Inequalities','Scale Drawings and Geometric Scale Factor','Circles: Circumference and Area','Angle Relationships: Supplementary, Complementary, and Vertical','Surface Area and Volume of 3D Figures','Probability: Simple and Compound Events','Statistics: Sampling and Drawing Inferences'] },
    ELA: { topics: ['Argument Essay: Claim, Counterclaim, and Evidence','Literary Analysis: Theme, Tone, and Mood','Literary Devices: Symbolism, Allegory, and Irony','Reading Informational Text: Analyzing Arguments','Research Writing: Evaluating and Citing Sources (MLA)','Grammar: Phrases, Clauses, and Sentence Variety','Vocabulary: Academic Word List and Context','Poetry Analysis: Speaker, Form, and Figurative Language','Narrative Writing: Plot Development and Conflict','Media Literacy: Analyzing Purpose and Bias'] },
    Science: { topics: ['Cell Division: Mitosis and Meiosis','Genetics: DNA, Genes, and Chromosomes','Heredity: Dominant and Recessive Traits','Punnett Squares and Probability of Traits','Evolution: Natural Selection and Adaptation','Evidence of Evolution: Fossils and Comparative Anatomy','Human Body: Organ Systems and Their Functions','Reproduction: Asexual and Sexual','Earth\'s History: Geologic Time Scale','Rock Cycle: Igneous, Sedimentary, and Metamorphic Rocks'] },
    'Social Studies': { topics: ['The Middle Ages: Feudalism and the Catholic Church','The Byzantine Empire and Eastern Christianity','The Islamic Golden Age and Expansion','African Kingdoms: Mali, Ghana, and Songhai','Asian Empires: Mongols, Tang, and Song China','The Renaissance: Art, Science, and Humanism','The Reformation: Protestant Movement and its Effects','Age of Exploration: Motives, Routes, and Consequences','Aztec and Inca Civilizations','Columbian Exchange: Causes and Global Impact'] },
    Health: { topics: ['Mental Health: Anxiety, Stress Management, and Resilience','Healthy Relationships: Communication and Respect','Recognizing Peer Pressure and Refusal Skills','Tobacco, Alcohol, and Drug Prevention','Reproductive Health: Puberty and Anatomy','STI Awareness and Prevention (Age-Appropriate)','First Aid: CPR Basics and Emergency Response','Nutrition: Calories, Portion Control, and Eating Disorders'] },
  },
  8: {
    Math: { topics: ['Properties of Exponents and Scientific Notation','Square Roots and Cube Roots','Proportional vs Non-Proportional Relationships','Slope: Definition, Rate of Change, and Graphing','Linear Equations: One Variable','Systems of Linear Equations: Graphing and Substitution','Functions: Definition, Notation, and Linear vs Nonlinear','Pythagorean Theorem and Its Converse','Volume of Cylinders, Cones, and Spheres','Bivariate Data: Scatter Plots and Lines of Best Fit'] },
    ELA: { topics: ['Argumentative Essay: Claim, Evidence, Counterclaim, and Rebuttal','Analyzing Author\'s Argument: Reasoning, Evidence, and Rhetoric','Literary Analysis: Complex Themes and Ambiguity','Reading Informational Text: Synthesizing Multiple Sources','Research Paper: MLA Formatting and Citation','Grammar: Conventions, Style, and Formal vs Informal Register','Vocabulary: Connotation, Denotation, and Nuance','Narrative Writing: Perspective, Pacing, and Tension','Media Literacy: Evaluating Claims and Detecting Bias','Seminal US Texts: Analyzing Historical Documents'] },
    Science: { topics: ['Force, Mass, and Newton\'s Three Laws of Motion','Momentum and Collisions','Wave Properties: Amplitude, Wavelength, and Frequency','The Electromagnetic Spectrum','Sound Waves: Transmission and the Ear','Light: Reflection, Refraction, and Lenses','Chemical Reactions: Reactants, Products, and Balancing Equations','Conservation of Matter in Chemical Reactions','Climate Change: Evidence, Causes, and Feedback Loops','Human Impact on the Environment and Sustainability'] },
    'Social Studies': { topics: ['The Industrial Revolution: Causes, Innovations, and Social Effects','Reconstruction: Successes, Failures, and Jim Crow Laws','Immigration and Urbanization (1870s–1920s)','The Progressive Era: Reform Movements and Key Figures','The Gilded Age: Robber Barons and Labor Movements','Manifest Destiny: Expansion, Conflict, and Native Americans','The Spanish-American War and US Imperialism','World War I: Causes, US Entry, and Treaty of Versailles','The Roaring Twenties and the Great Depression','The New Deal: Government\'s Role in the Economy'] },
  },
  9: {
    Math: { topics: ['Algebra I: Properties and Simplifying Expressions','Algebra I: Solving One- and Two-Step Equations','Algebra I: Multi-Step and Literal Equations','Algebra I: Linear Inequalities and Graphing','Algebra I: Systems of Equations (Graphing, Substitution, Elimination)','Algebra I: Polynomials: Adding, Subtracting, and Multiplying','Algebra I: Factoring Polynomials','Algebra I: Quadratic Equations (Standard Form and Factoring)','Algebra I: Functions, Domain, and Range','Geometry: Points, Lines, Planes, Angles, and Proofs'] },
    ELA: { topics: ['American Literature: Short Stories and the American Dream','American Literature: Poetry (Whitman, Dickinson, Frost)','Expository Writing: Thesis Development and Essay Structure','Persuasive Writing: Rhetorical Appeals (Ethos, Pathos, Logos)','Reading: Analyzing Rhetoric in Historical Speeches','Literary Analysis: Characterization, Conflict, and Symbol','Grammar: Conventions, Style, and Voice','Vocabulary: SAT High-Frequency Words in Context','Research Paper: Annotated Bibliography and MLA Citation','Reading Informational Text: Evaluating Sources and Bias'] },
    Science: { topics: ['Biology: Cell Theory and Types of Cells','Biology: Cell Organelles and Their Functions','Biology: Cell Membrane and Transport (Osmosis, Diffusion)','Biology: Photosynthesis and Cellular Respiration','Biology: Mitosis and the Cell Cycle','Biology: Meiosis and Genetic Variation','Biology: Mendelian Genetics and Punnett Squares','Biology: DNA Structure and Replication','Biology: Protein Synthesis (Transcription and Translation)','Biology: Evolution: Evidence, Natural Selection, and Speciation'] },
    'Social Studies': { topics: ['World History: World War I \u2014 Causes and Alliances','World History: The Russian Revolution and the Rise of Communism','World History: The Rise of Fascism and Nazism','World History: World War II \u2014 Causes, Theater, and Holocaust','World History: The Cold War \u2014 Origins and Proxy Wars','World History: Decolonization in Africa and Asia','World History: The Korean War and Vietnam War','World History: The Space Race and Nuclear Arms Race','Geography: Political and Economic Systems Around the World','Human Rights: Universal Declaration and Modern Struggles'] },
    Health: { topics: ['Mental Health: Depression, Anxiety, and Seeking Help','Suicide Prevention and Crisis Resources','Healthy Relationships, Consent, and Boundaries','Sexual Health: Contraception and STI Prevention','Substance Abuse: Understanding Addiction and Recovery','Nutrition: Macronutrients, Micronutrients, and Metabolism','Fitness: FITT Principle and Personalized Fitness Plans','Environmental Health: Toxins, Pollutants, and Advocacy'] },
  },
  10: {
    Math: { topics: ['Algebra II: Complex Numbers and Operations','Algebra II: Solving Quadratic Equations (Quadratic Formula, Completing the Square)','Algebra II: Polynomial Functions and Graphs','Algebra II: Rational Expressions and Equations','Algebra II: Radical Expressions and Equations','Algebra II: Exponential and Logarithmic Functions','Algebra II: Sequences and Series (Arithmetic and Geometric)','Geometry: Similarity, Congruence, and Triangle Proofs','Geometry: Right Triangle Trigonometry (SOH-CAH-TOA)','Statistics: Normal Distribution, Z-Scores, and Probability'] },
    ELA: { topics: ['World Literature: Latin American Magical Realism','World Literature: Postcolonial African and Asian Voices','World Literature: European Literary Movements (Realism, Modernism)','Advanced Composition: Research Paper with Chicago/MLA Style','Analytical Writing: Literary Criticism and Theory','Rhetoric and Argumentation: Analyzing Political and Historical Speeches','Reading: Comparing World Texts Across Cultures','Vocabulary: Advanced Academic and Discipline-Specific Words','Grammar: Syntax, Diction, and Style in Professional Writing','Media and Digital Literacy: Evaluating Online Sources and Propaganda'] },
    Science: { topics: ['Chemistry: Atomic Structure, Electron Configuration, and Periodic Trends','Chemistry: The Periodic Table: Groups, Periods, and Properties','Chemistry: Chemical Bonding: Ionic, Covalent, and Metallic','Chemistry: Naming Compounds and Writing Chemical Formulas','Chemistry: Chemical Reactions: Types and Balancing Equations','Chemistry: Stoichiometry: Mole Ratios and Limiting Reagents','Chemistry: States of Matter, Gas Laws, and Kinetic Molecular Theory','Chemistry: Acids, Bases, and pH','Physics: Kinematics: Motion, Velocity, and Acceleration','Physics: Newton\'s Laws Applied: Forces, Friction, and Free Body Diagrams'] },
    'Social Studies': { topics: ['US Government: Constitutional Principles and Federalism','US Government: The Bill of Rights and Civil Liberties','US Government: The Three Branches and Checks and Balances','US Government: The Legislative Process and Congress','US Government: The Electoral College and Voting Rights','US History: Civil Rights Movement \u2014 Leaders and Legislation','US History: Vietnam War and Anti-War Movement','US History: The Cold War at Home \u2014 McCarthyism and Space Race','US History: Modern America (1980s\u2013Present)','Economics: Fiscal Policy, Monetary Policy, and the Federal Reserve'] },
  },
};

/* =============================================================
   DOM References
   ============================================================= */
const gradeSelect        = document.getElementById('grade');
const subjectSelect      = document.getElementById('subject');
const topicSelect        = document.getElementById('topic');
const difficultySelect   = document.getElementById('difficulty');
const questionCountSelect= document.getElementById('questionCount');
const formatSelect       = document.getElementById('format');
const includeAnswerKey   = document.getElementById('includeAnswerKey');
const studentNameInput   = document.getElementById('studentName');
const worksheetDateInput = document.getElementById('worksheetDate');
const teacherNameInput   = document.getElementById('teacherName');
const periodInput        = document.getElementById('period');
const classNameInput     = document.getElementById('className');
const generateBtn        = document.getElementById('generateBtn');
const worksheetForm      = document.getElementById('worksheetForm');

const formSection        = document.getElementById('formSection');
const loadingSection     = document.getElementById('loadingSection');
const resultsSection     = document.getElementById('resultsSection');
const errorSection       = document.getElementById('errorSection');

const downloadButtons    = document.getElementById('downloadButtons');
const resultsDescription = document.getElementById('resultsDescription');
const errorMessage       = document.getElementById('errorMessage');
const errorRequestId     = document.getElementById('errorRequestId');
const generateAnotherBtn = document.getElementById('generateAnotherBtn');
const dismissErrorBtn    = document.getElementById('dismissErrorBtn');

/* Field-error spans */
const fieldErrors = {
  grade:         document.getElementById('gradeError'),
  subject:       document.getElementById('subjectError'),
  topic:         document.getElementById('topicError'),
  difficulty:    document.getElementById('difficultyError'),
  questionCount: document.getElementById('questionCountError'),
  format:        document.getElementById('formatError'),
};

/* =============================================================
   Dropdown Population Helpers
   ============================================================= */

/**
 * Clears a select element back to its placeholder option and
 * optionally disables it.
 *
 * @param {HTMLSelectElement} select
 * @param {string} placeholder
 * @param {boolean} disable
 */
function resetSelect(select, placeholder, disable) {
  select.innerHTML = `<option value="">${placeholder}</option>`;
  select.disabled = disable;
}

/**
 * Appends a list of string values as <option> elements.
 *
 * @param {HTMLSelectElement} select
 * @param {string[]} values
 */
function populateOptions(select, values) {
  values.forEach((value) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  });
}

/**
 * Populates the Subject dropdown for the given grade and resets Topic.
 *
 * @param {number} grade
 */
function populateSubjects(grade) {
  resetSelect(subjectSelect, 'Select subject\u2026', false);
  resetSelect(topicSelect, 'Select topic\u2026', true);

  const gradeData = CURRICULUM[grade];
  if (!gradeData) return;

  populateOptions(subjectSelect, Object.keys(gradeData));
}

/**
 * Populates the Topic dropdown for the given grade and subject.
 *
 * @param {number} grade
 * @param {string} subject
 */
function populateTopics(grade, subject) {
  resetSelect(topicSelect, 'Select topic\u2026', false);

  const subjectData = CURRICULUM[grade] && CURRICULUM[grade][subject];
  if (!subjectData) return;

  populateOptions(topicSelect, subjectData.topics);
}

/* =============================================================
   Validation
   ============================================================= */

/** Required select fields in order. */
const REQUIRED_SELECTS = [
  { el: gradeSelect,         key: 'grade',         label: 'Grade' },
  { el: subjectSelect,       key: 'subject',        label: 'Subject' },
  { el: topicSelect,         key: 'topic',          label: 'Topic' },
  { el: difficultySelect,    key: 'difficulty',     label: 'Difficulty' },
  { el: questionCountSelect, key: 'questionCount',  label: 'Number of Questions' },
  { el: formatSelect,        key: 'format',         label: 'Output Format' },
];

/**
 * Returns true if every required select has a non-empty value.
 *
 * @returns {boolean}
 */
function allFieldsFilled() {
  return REQUIRED_SELECTS.every(({ el }) => el.value !== '');
}

/**
 * Updates the Generate button's disabled state based on field completeness.
 */
function syncGenerateButton() {
  generateBtn.disabled = !allFieldsFilled();
}

/**
 * Validates all fields, marks invalid ones, and returns whether the form is valid.
 *
 * @returns {boolean}
 */
function validateForm() {
  let valid = true;

  REQUIRED_SELECTS.forEach(({ el, key, label }) => {
    if (el.value === '') {
      showFieldError(key, `${label} is required.`);
      el.classList.add('is-invalid');
      valid = false;
    } else {
      clearFieldError(key);
      el.classList.remove('is-invalid');
    }
  });

  /* Grade range guard (defends against DOM manipulation) */
  const g = Number(gradeSelect.value);
  if (g < 1 || g > 10) {
    showFieldError('grade', 'Grade must be between 1 and 10.');
    gradeSelect.classList.add('is-invalid');
    valid = false;
  }

  return valid;
}

/**
 * @param {string} key
 * @param {string} message
 */
function showFieldError(key, message) {
  const span = fieldErrors[key];
  if (span) span.textContent = message;
}

/** @param {string} key */
function clearFieldError(key) {
  const span = fieldErrors[key];
  if (span) span.textContent = '';
}

/* =============================================================
   UI State Transitions
   ============================================================= */

/** Shows the loading state and hides everything else. */
function showLoading() {
  formSection.hidden    = true;
  resultsSection.hidden = true;
  errorSection.hidden   = true;
  loadingSection.hidden = false;
}

/** Shows the form and hides loading / results / error. */
function showForm() {
  loadingSection.hidden = true;
  resultsSection.hidden = true;
  errorSection.hidden   = true;
  formSection.hidden    = false;
}

/**
 * Renders the results section with download buttons.
 *
 * @param {Object} data          API response body
 * @param {string} data.worksheetKey
 * @param {string|null} data.answerKeyKey
 * @param {Object} data.metadata
 * @param {boolean} requestedAnswerKey  Whether the user checked "Include Answer Key"
 * @param {string} selectedFormat
 */
function showResults(data, requestedAnswerKey, selectedFormat) {
  const { worksheetKey, answerKeyKey, metadata } = data;

  /* Build description line */
  const grade   = metadata && metadata.grade   ? `Grade ${metadata.grade}` : '';
  const subject = metadata && metadata.subject ? metadata.subject          : '';
  const topic   = metadata && metadata.topic   ? metadata.topic            : '';
  resultsDescription.textContent = [grade, subject, topic].filter(Boolean).join(' \u00b7 ');

  /* Clear previous buttons */
  downloadButtons.innerHTML = '';

  /* Worksheet download button */
  const worksheetBtn = buildDownloadButton(selectedFormat, worksheetKey);
  downloadButtons.appendChild(worksheetBtn);

  /* Answer key button — only if requested and key is returned */
  if (requestedAnswerKey && answerKeyKey) {
    const answerKeyBtn = buildAnswerKeyButton(answerKeyKey);
    downloadButtons.appendChild(answerKeyBtn);
  }

  /* Solve Online button — always shown when a worksheetId is available */
  if (metadata && metadata.id) {
    const solveBtn = document.createElement('button');
    solveBtn.type = 'button';
    solveBtn.className = 'btn btn--solve download-btn';
    solveBtn.textContent = 'Solve Online';
    solveBtn.setAttribute('role', 'listitem');
    solveBtn.addEventListener('click', () => {
      window.open(`/solve.html?id=${metadata.id}`, '_blank', 'noopener,noreferrer');
    });
    downloadButtons.appendChild(solveBtn);
  }

  loadingSection.hidden = true;
  formSection.hidden    = true;
  errorSection.hidden   = true;
  resultsSection.hidden = false;
}

/**
 * Shows the error section with the given message.
 *
 * @param {string} message
 * @param {Object} diagnostics
 */
function showError(message, diagnostics = {}) {
  errorMessage.textContent = message;

  const detailParts = [];
  if (diagnostics.requestId) detailParts.push(`Request ID: ${diagnostics.requestId}`);
  if (diagnostics.clientRequestId) detailParts.push(`Client Request ID: ${diagnostics.clientRequestId}`);
  if (diagnostics.errorCode) detailParts.push(`Code: ${diagnostics.errorCode}`);
  if (diagnostics.errorStage) detailParts.push(`Stage: ${diagnostics.errorStage}`);
  if (typeof diagnostics.status === 'number') detailParts.push(`HTTP: ${diagnostics.status}`);

  if (errorRequestId) {
    if (detailParts.length > 0) {
      errorRequestId.textContent = detailParts.join(' · ');
      errorRequestId.hidden = false;
    } else {
      errorRequestId.textContent = '';
      errorRequestId.hidden = true;
    }
  }

  loadingSection.hidden = true;
  resultsSection.hidden = true;
  formSection.hidden    = true;
  errorSection.hidden   = false;
}

function createClientRequestId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildGenerateError({ message, status, requestId, clientRequestId, errorCode, errorStage, responseBody }) {
  const error = new Error(message);
  error.status = status;
  error.requestId = requestId;
  error.clientRequestId = clientRequestId;
  error.errorCode = errorCode;
  error.errorStage = errorStage;
  error.responseBody = responseBody;
  return error;
}

/* =============================================================
   Download Button Builders
   ============================================================= */

/** Map from format value to button label and CSS modifier. */
const FORMAT_BUTTON_META = {
  pdf:  { label: 'Download PDF',       modifier: 'pdf'  },
  docx: { label: 'Download Word File', modifier: 'docx' },
  html: { label: 'Download HTML',      modifier: 'html' },
};

const FORMAT_TO_EXTENSION = {
  'PDF': 'pdf',
  'Word (.docx)': 'docx',
  'HTML': 'html',
};

/**
 * Creates the worksheet download button element.
 *
 * @param {string} format
 * @param {string} s3Key
 * @returns {HTMLButtonElement}
 */
function buildDownloadButton(format, s3Key) {
  const normalizedFormat = FORMAT_TO_EXTENSION[format] || String(format || '').toLowerCase();
  const meta = FORMAT_BUTTON_META[normalizedFormat] || { label: 'Download Worksheet', modifier: 'pdf' };
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn btn--${meta.modifier} download-btn`;
  btn.textContent = meta.label;
  btn.setAttribute('role', 'listitem');
  btn.addEventListener('click', () => triggerDownload(s3Key));
  return btn;
}

/**
 * Creates the answer key download button element.
 *
 * @param {string} s3Key
 * @returns {HTMLButtonElement}
 */
function buildAnswerKeyButton(s3Key) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--key download-btn';
  btn.textContent = 'Download Answer Key';
  btn.setAttribute('role', 'listitem');
  btn.addEventListener('click', () => triggerDownload(s3Key));
  return btn;
}

/* =============================================================
   API Calls
   ============================================================= */

/**
 * Calls GET /api/download?key=<s3Key> to obtain a presigned URL,
 * then opens it in a new browser tab.
 *
 * @param {string} s3Key
 */
async function triggerDownload(s3Key) {
  try {
    const res = await fetch(`/api/download?key=${encodeURIComponent(s3Key)}`);
    const data = await res.json();

    if (!res.ok || !data.downloadUrl) {
      throw new Error(data.error || 'Could not retrieve the download link. Please try again.');
    }

    window.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
  } catch (err) {
    /* Non-blocking: alert is acceptable for a download failure */
    alert(`Download failed: ${err.message}`);
  }
}

/**
 * POSTs to /api/generate with the current form values.
 *
 * @param {Object} payload
 * @returns {Promise<Object>} Parsed response body
 */
async function callGenerateApi(payload, clientRequestId) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-request-id': clientRequestId,
    },
    body: JSON.stringify(payload),
  });

  const rawText = await res.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw buildGenerateError({
      message: `The server returned an unexpected response (HTTP ${res.status}). Make sure the backend is running.`,
      status: res.status,
      requestId: res.headers.get('x-request-id'),
      clientRequestId,
      responseBody: rawText,
    });
  }

  const requestId = res.headers.get('x-request-id') || data?.requestId || null;
  const echoedClientRequestId = res.headers.get('x-client-request-id') || data?.clientRequestId || clientRequestId;

  if (!res.ok) {
    throw buildGenerateError({
      message: data?.error || `Server error (${res.status}). Please try again.`,
      status: res.status,
      requestId,
      clientRequestId: echoedClientRequestId,
      errorCode: data?.errorCode || null,
      errorStage: data?.errorStage || null,
      responseBody: data,
    });
  }

  if (data.success === false) {
    throw buildGenerateError({
      message: data.error || 'Worksheet generation failed. Please try again.',
      status: res.status,
      requestId,
      clientRequestId: echoedClientRequestId,
      errorCode: data.errorCode || null,
      errorStage: data.errorStage || null,
      responseBody: data,
    });
  }

  if (!data.worksheetKey) {
    throw buildGenerateError({
      message: 'No worksheet was returned by the server. Please try again.',
      status: res.status,
      requestId,
      clientRequestId: echoedClientRequestId,
      errorCode: 'MISSING_WORKSHEET_KEY',
      errorStage: 'response:validate-body',
      responseBody: data,
    });
  }

  console.info('Learnfyra generate request succeeded', {
    requestId,
    clientRequestId: echoedClientRequestId,
    worksheetKey: data.worksheetKey,
    answerKeyKey: data.answerKeyKey,
    metadata: data.metadata ? {
      id: data.metadata.id,
      grade: data.metadata.grade,
      subject: data.metadata.subject,
      topic: data.metadata.topic,
      difficulty: data.metadata.difficulty,
      questionCount: data.metadata.questionCount,
      format: data.metadata.format,
    } : null,
  });

  return data;
}

/* =============================================================
   Form Submit Handler
   ============================================================= */

/**
 * Handles the Generate Worksheet form submission.
 *
 * @param {SubmitEvent} event
 */
async function handleFormSubmit(event) {
  event.preventDefault();

  if (!validateForm()) return;

  const grade           = Number(gradeSelect.value);
  const subject         = subjectSelect.value;
  const topic           = topicSelect.value;
  const difficulty      = difficultySelect.value;
  const questionCount   = Number(questionCountSelect.value);
  const format          = formatSelect.value;
  const wantsAnswerKey  = includeAnswerKey.checked;
  const studentName     = studentNameInput.value.trim();
  const worksheetDate   = worksheetDateInput.value;
  const teacherName     = teacherNameInput.value.trim();
  const period          = periodInput.value.trim();
  const className       = classNameInput.value.trim();

  const payload = {
    grade,
    subject,
    topic,
    difficulty,
    questionCount,
    format,
    includeAnswerKey: wantsAnswerKey,
    studentName,
    worksheetDate,
    teacherName,
    period,
    className,
  };

  const clientRequestId = createClientRequestId();

  console.info('Learnfyra generate request started', {
    clientRequestId,
    payload: {
      grade,
      subject,
      topic,
      difficulty,
      questionCount,
      format,
      includeAnswerKey: wantsAnswerKey,
    },
  });

  showLoading();

  try {
    const data = await callGenerateApi(payload, clientRequestId);
    showResults(data, wantsAnswerKey, format);
  } catch (err) {
    console.error('Learnfyra generate request failed', {
      message: err.message,
      status: err.status,
      requestId: err.requestId || null,
      clientRequestId: err.clientRequestId || clientRequestId,
      errorCode: err.errorCode || null,
      errorStage: err.errorStage || null,
      responseBody: err.responseBody || null,
    });

    showError(err.message, {
      status: err.status,
      requestId: err.requestId || null,
      clientRequestId: err.clientRequestId || clientRequestId,
      errorCode: err.errorCode || null,
      errorStage: err.errorStage || null,
    });
  }
}

/* =============================================================
   Event Listeners
   ============================================================= */

/* Grade change → repopulate Subject, clear Topic */
gradeSelect.addEventListener('change', () => {
  const grade = Number(gradeSelect.value);
  clearFieldError('grade');
  gradeSelect.classList.remove('is-invalid');

  if (grade) {
    populateSubjects(grade);
  } else {
    resetSelect(subjectSelect, 'Select subject\u2026', true);
    resetSelect(topicSelect,   'Select topic\u2026',   true);
  }

  syncGenerateButton();
});

/* Subject change → repopulate Topic */
subjectSelect.addEventListener('change', () => {
  const grade   = Number(gradeSelect.value);
  const subject = subjectSelect.value;

  clearFieldError('subject');
  subjectSelect.classList.remove('is-invalid');

  if (subject) {
    populateTopics(grade, subject);
  } else {
    resetSelect(topicSelect, 'Select topic\u2026', true);
  }

  syncGenerateButton();
});

/* Any select change → sync Generate button + clear inline error */
[topicSelect, difficultySelect, questionCountSelect, formatSelect].forEach((el) => {
  el.addEventListener('change', () => {
    const key = el.id;
    clearFieldError(key);
    el.classList.remove('is-invalid');
    syncGenerateButton();
  });
});

/* Form submit */
worksheetForm.addEventListener('submit', handleFormSubmit);

/* "Generate Another" — show form, preserving all field values */
generateAnotherBtn.addEventListener('click', () => {
  syncGenerateButton();
  showForm();
});

/* "Try Again" from error box */
dismissErrorBtn.addEventListener('click', () => {
  showForm();
});

/* =============================================================
   Initialise on Page Load
   ============================================================= */

(function init() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  worksheetDateInput.value = `${today.getFullYear()}-${month}-${day}`;

  /* Populate Grade dropdown */
  for (let g = 1; g <= 10; g++) {
    const opt = document.createElement('option');
    opt.value = String(g);
    opt.textContent = `Grade ${g}`;
    gradeSelect.appendChild(opt);
  }

  /* Subject and Topic start disabled until Grade is chosen */
  subjectSelect.disabled = true;
  topicSelect.disabled   = true;

  /* Generate button starts disabled */
  generateBtn.disabled = true;
})();
