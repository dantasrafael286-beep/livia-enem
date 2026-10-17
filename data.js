// Conteúdos do ENEM por área.
// peso = quanto o assunto costuma aparecer nas provas anteriores
// (3 = cai muito, 2 = cai bastante, 1 = cai às vezes). É uma estimativa, não estatística oficial.
window.AREAS = {
  lc:  { nome: "Linguagens", curto: "LC", dia: 1, cor: "var(--area-lc)" },
  ch:  { nome: "Humanas",    curto: "CH", dia: 1, cor: "var(--area-ch)" },
  cn:  { nome: "Natureza",   curto: "CN", dia: 2, cor: "var(--area-cn)" },
  mt:  { nome: "Matemática", curto: "MT", dia: 2, cor: "var(--area-mt)" },
  red: { nome: "Redação",    curto: "RED", dia: 1, cor: "var(--area-red)" },
};

window.TOPICOS = [
  // ---------- Matemática ----------
  { id: "mt-estat", area: "mt", nome: "Estatística: média, moda e mediana", peso: 3, foco: "mediana com dados em tabela e média ponderada" },
  { id: "mt-porc", area: "mt", nome: "Porcentagem e juros", peso: 3, foco: "aumentos e descontos sucessivos, juros simples e compostos" },
  { id: "mt-prop", area: "mt", nome: "Razão, proporção e regra de três", peso: 3, foco: "grandezas direta e inversamente proporcionais" },
  { id: "mt-graf", area: "mt", nome: "Leitura de gráficos e tabelas", peso: 3, foco: "variação, taxa e comparação entre barras/linhas" },
  { id: "mt-gplana", area: "mt", nome: "Geometria plana: áreas e perímetros", peso: 3, foco: "áreas de figuras compostas, semelhança de triângulos" },
  { id: "mt-gesp", area: "mt", nome: "Geometria espacial: volumes e planificação", peso: 2, foco: "volume de prismas, cilindros e cones; vistas e planificações" },
  { id: "mt-escala", area: "mt", nome: "Escalas e unidades de medida", peso: 2, foco: "conversão de unidades, escala de mapas e plantas" },
  { id: "mt-prob", area: "mt", nome: "Probabilidade", peso: 2, foco: "casos favoráveis/possíveis, probabilidade condicional simples" },
  { id: "mt-func", area: "mt", nome: "Funções do 1º e 2º grau", peso: 2, foco: "ler o gráfico, vértice da parábola (máximo/mínimo)" },
  { id: "mt-comb", area: "mt", nome: "Análise combinatória", peso: 1, foco: "princípio multiplicativo, arranjo × combinação" },
  { id: "mt-explog", area: "mt", nome: "Exponencial e logaritmo", peso: 1, foco: "crescimento exponencial e propriedades do log" },
  { id: "mt-pa", area: "mt", nome: "Progressões (PA e PG)", peso: 1, foco: "termo geral e soma" },
  { id: "mt-trig", area: "mt", nome: "Trigonometria", peso: 1, foco: "seno, cosseno e tangente no triângulo retângulo; funções periódicas" },
  { id: "mt-logica", area: "mt", nome: "Sequências e raciocínio lógico", peso: 1, foco: "padrões e contagem" },

  // ---------- Natureza: Biologia ----------
  { id: "cn-eco", area: "cn", sub: "Biologia", nome: "Ecologia e impactos ambientais", peso: 3, foco: "cadeias alimentares, ciclos (carbono, nitrogênio), poluição" },
  { id: "cn-fisio", area: "cn", sub: "Biologia", nome: "Fisiologia humana", peso: 2, foco: "sistemas nervoso, digestório, circulatório e imunológico" },
  { id: "cn-saude", area: "cn", sub: "Biologia", nome: "Doenças, vacinas e saúde pública", peso: 2, foco: "vírus × bactéria, vacina × soro, verminoses" },
  { id: "cn-gen", area: "cn", sub: "Biologia", nome: "Genética e hereditariedade", peso: 2, foco: "1ª Lei de Mendel, heredogramas, grupos sanguíneos" },
  { id: "cn-cito", area: "cn", sub: "Biologia", nome: "Citologia", peso: 1, foco: "organelas, membrana, DNA e síntese de proteínas" },
  { id: "cn-evo", area: "cn", sub: "Biologia", nome: "Evolução", peso: 1, foco: "seleção natural, Darwin × Lamarck" },
  { id: "cn-biotec", area: "cn", sub: "Biologia", nome: "Biotecnologia", peso: 1, foco: "transgênicos, clonagem, PCR" },
  { id: "cn-bot", area: "cn", sub: "Biologia", nome: "Botânica", peso: 1, foco: "fotossíntese, transpiração, polinização" },
  // ---------- Natureza: Química ----------
  { id: "cn-qamb", area: "cn", sub: "Química", nome: "Química ambiental", peso: 3, foco: "chuva ácida, efeito estufa, tratamento de água e esgoto" },
  { id: "cn-org", area: "cn", sub: "Química", nome: "Química orgânica", peso: 2, foco: "funções orgânicas, isomeria, polímeros" },
  { id: "cn-esteq", area: "cn", sub: "Química", nome: "Estequiometria", peso: 2, foco: "mol, proporção da reação, rendimento" },
  { id: "cn-sol", area: "cn", sub: "Química", nome: "Soluções e concentração", peso: 2, foco: "concentração comum, diluição e mistura" },
  { id: "cn-eletroq", area: "cn", sub: "Química", nome: "Eletroquímica", peso: 1, foco: "pilhas, eletrólise, oxidação e redução" },
  { id: "cn-equil", area: "cn", sub: "Química", nome: "Equilíbrio químico e pH", peso: 1, foco: "ácido × base, deslocamento de equilíbrio" },
  { id: "cn-termoq", area: "cn", sub: "Química", nome: "Termoquímica e cinética", peso: 1, foco: "reação exo/endotérmica e velocidade de reação" },
  { id: "cn-mist", area: "cn", sub: "Química", nome: "Separação de misturas e propriedades", peso: 1, foco: "filtração, destilação, densidade" },
  // ---------- Natureza: Física ----------
  { id: "cn-eletr", area: "cn", sub: "Física", nome: "Eletricidade e consumo de energia", peso: 3, foco: "circuitos, potência, conta de luz (kWh)" },
  { id: "cn-mec", area: "cn", sub: "Física", nome: "Mecânica: movimento e leis de Newton", peso: 2, foco: "velocidade média, MRU/MRUV, força e atrito" },
  { id: "cn-energia", area: "cn", sub: "Física", nome: "Energia e conservação", peso: 2, foco: "energia cinética e potencial, usinas e transformações" },
  { id: "cn-ondas", area: "cn", sub: "Física", nome: "Ondas e acústica", peso: 2, foco: "frequência, comprimento de onda, som" },
  { id: "cn-optica", area: "cn", sub: "Física", nome: "Óptica", peso: 1, foco: "espelhos, lentes, refração" },
  { id: "cn-termo", area: "cn", sub: "Física", nome: "Calor e termodinâmica", peso: 1, foco: "calor específico, trocas de calor, máquinas térmicas" },
  { id: "cn-hidro", area: "cn", sub: "Física", nome: "Hidrostática", peso: 1, foco: "pressão, empuxo, densidade" },
  { id: "cn-mag", area: "cn", sub: "Física", nome: "Magnetismo e indução", peso: 1, foco: "ímãs, geradores e motores" },

  // ---------- Humanas: História ----------
  { id: "ch-vargas", area: "ch", sub: "História", nome: "Era Vargas", peso: 2, foco: "trabalhismo, CLT, Estado Novo" },
  { id: "ch-ditadura", area: "ch", sub: "História", nome: "Ditadura Militar e redemocratização", peso: 2, foco: "AI-5, censura, Diretas Já, Constituição de 1988" },
  { id: "ch-afro", area: "ch", sub: "História", nome: "Escravidão, povos indígenas e cultura afro-brasileira", peso: 3, foco: "resistência, quilombos, abolição e suas consequências" },
  { id: "ch-colonia", area: "ch", sub: "História", nome: "Brasil Colônia", peso: 1, foco: "ciclos econômicos, jesuítas, revoltas coloniais" },
  { id: "ch-imperio", area: "ch", sub: "História", nome: "Brasil Império", peso: 1, foco: "independência, regências, café, Lei de Terras" },
  { id: "ch-rvelha", area: "ch", sub: "História", nome: "República Velha", peso: 1, foco: "coronelismo, Canudos, café com leite" },
  { id: "ch-antiga", area: "ch", sub: "História", nome: "Antiguidade e Idade Média", peso: 1, foco: "democracia grega, feudalismo, Igreja" },
  { id: "ch-revol", area: "ch", sub: "História", nome: "Iluminismo e Revoluções (Francesa, Industrial)", peso: 2, foco: "direitos, trabalho fabril, liberalismo" },
  { id: "ch-guerras", area: "ch", sub: "História", nome: "Guerras Mundiais e Guerra Fria", peso: 1, foco: "totalitarismos, bipolaridade" },
  // ---------- Humanas: Geografia ----------
  { id: "ch-amb", area: "ch", sub: "Geografia", nome: "Questões ambientais e clima", peso: 3, foco: "biomas, desmatamento, mudanças climáticas" },
  { id: "ch-agro", area: "ch", sub: "Geografia", nome: "Agropecuária e espaço rural", peso: 2, foco: "agronegócio, fronteira agrícola, reforma agrária" },
  { id: "ch-urb", area: "ch", sub: "Geografia", nome: "Urbanização", peso: 2, foco: "metropolização, segregação, problemas urbanos" },
  { id: "ch-glob", area: "ch", sub: "Geografia", nome: "Globalização e geopolítica", peso: 1, foco: "blocos econômicos, fluxos, conflitos" },
  { id: "ch-carto", area: "ch", sub: "Geografia", nome: "Cartografia", peso: 1, foco: "escala, projeções, fusos" },
  { id: "ch-relevo", area: "ch", sub: "Geografia", nome: "Relevo, solos e hidrografia", peso: 1, foco: "erosão, bacias hidrográficas" },
  { id: "ch-energ", area: "ch", sub: "Geografia", nome: "Energia e indústria", peso: 1, foco: "matriz energética, industrialização brasileira" },
  { id: "ch-pop", area: "ch", sub: "Geografia", nome: "População e migrações", peso: 1, foco: "pirâmide etária, êxodo rural, migração nordestina" },
  // ---------- Humanas: Filosofia e Sociologia ----------
  { id: "ch-soc", area: "ch", sub: "Sociologia", nome: "Cidadania, movimentos sociais e trabalho", peso: 3, foco: "direitos, desigualdade, mundo do trabalho" },
  { id: "ch-cult", area: "ch", sub: "Sociologia", nome: "Cultura, ideologia e indústria cultural", peso: 1, foco: "etnocentrismo, Escola de Frankfurt" },
  { id: "ch-filoant", area: "ch", sub: "Filosofia", nome: "Filosofia antiga", peso: 1, foco: "Sócrates, Platão, Aristóteles" },
  { id: "ch-filomod", area: "ch", sub: "Filosofia", nome: "Filosofia moderna e contratualistas", peso: 2, foco: "Hobbes, Locke, Rousseau, Descartes, Kant" },

  // ---------- Linguagens ----------
  { id: "lc-interp", area: "lc", nome: "Interpretação de texto e gêneros", peso: 3, foco: "finalidade do texto, gênero, inferência" },
  { id: "lc-variacao", area: "lc", nome: "Variação linguística", peso: 2, foco: "regional, social, preconceito linguístico" },
  { id: "lc-modern", area: "lc", nome: "Literatura: Modernismo", peso: 2, foco: "Semana de 22, gerações modernistas" },
  { id: "lc-lit", area: "lc", nome: "Literatura: Romantismo ao Simbolismo", peso: 1, foco: "características de cada escola" },
  { id: "lc-funcoes", area: "lc", nome: "Funções da linguagem", peso: 1, foco: "referencial, emotiva, conativa, metalinguística..." },
  { id: "lc-figuras", area: "lc", nome: "Figuras de linguagem e sentido", peso: 1, foco: "metáfora, ironia, ambiguidade" },
  { id: "lc-coesao", area: "lc", nome: "Gramática em uso e coesão", peso: 2, foco: "conectivos, pronomes, efeitos de sentido" },
  { id: "lc-arte", area: "lc", nome: "Artes e vanguardas", peso: 1, foco: "arte contemporânea, vanguardas europeias" },
  { id: "lc-edfis", area: "lc", nome: "Educação física e corpo", peso: 1, foco: "esporte × saúde, padrões de beleza" },
  { id: "lc-estrang", area: "lc", nome: "Inglês/Espanhol", peso: 2, foco: "5 questões: interpretação, sem gramática pesada" },
  { id: "lc-digital", area: "lc", nome: "Textos digitais e tecnologia", peso: 1, foco: "memes, redes sociais, fake news" },

  // ---------- Redação ----------
  { id: "red-c1", area: "red", nome: "C1: norma culta", peso: 2, foco: "concordância, crase, pontuação" },
  { id: "red-c2", area: "red", nome: "C2: tema e repertório", peso: 3, foco: "não fugir do tema, repertório legitimado e produtivo" },
  { id: "red-c3", area: "red", nome: "C3: argumentação", peso: 3, foco: "projeto de texto, desenvolver em vez de listar" },
  { id: "red-c4", area: "red", nome: "C4: coesão", peso: 2, foco: "conectivos entre e dentro dos parágrafos" },
  { id: "red-c5", area: "red", nome: "C5: proposta de intervenção", peso: 3, foco: "agente, ação, meio, finalidade e detalhamento" },
];

window.VERSOS = [
  "Uma página por dia, sem pressa e sem atraso:\nquem estuda com calma chega sempre no prazo.",
  "Questão fácil primeiro, que a TRI agradece:\nquem garante o básico é quem mais cresce.",
  "Não precisa saber tudo, precisa saber bem\no que mais cai na prova, e isso você tem.",
  "Caneta preta, documento e coração tranquilo:\no resto é estudo, e estudo é seu estilo.",
  "Semente não vira árvore de um dia pro outro:\nnota boa também não, mas cresce pouco a pouco.",
  "Cada erro anotado é um erro a menos\nno domingo da prova, de olhos serenos.",
  "Redação vale mil, cinco vezes duzentos:\nproposta completa e sem rodeios nem lamentos.",
  "Quem estuda não se perde, quem revisa não esquece:\no mapa tá no caderno, e o caminho aparece.",
  "Cansou? Respira fundo, bebe água, dá um tempo:\nsequência não é corrida, é constância e é alento.",
  "Chute não tira ponto, então nada em branco:\nmarca tudo no fim, com calma e sem tranco.",
];
