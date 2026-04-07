export const DEFAULT_TERMS_AND_CONDITIONS = {
  piojologa: [
    'Al usar este panel como piojologa aceptas las siguientes condiciones:',
    '',
    '1. Atenderas unicamente los servicios asignados y confirmados dentro de la plataforma.',
    '2. Debes presentarte puntualmente y reportar cualquier novedad al equipo administrativo.',
    '3. La informacion de clientes, direcciones y telefonos es confidencial y solo puede usarse para la prestacion del servicio.',
    '4. Debes registrar correctamente el estado de cada servicio y los valores correspondientes al finalizar.',
    '5. El uso indebido de la plataforma, el maltrato a clientes o el incumplimiento reiterado podra generar suspension del acceso.',
  ].join('\n'),
  vendedor: [
    'Al usar este panel como vendedor aceptas las siguientes condiciones:',
    '',
    '1. Compartiras unicamente enlaces, mensajes y material autorizado por Chao Piojos.',
    '2. No puedes ofrecer descuentos, beneficios o condiciones no aprobadas por la administracion.',
    '3. Las comisiones solo se reconocen sobre agendamientos validados dentro del sistema.',
    '4. Debes manejar la informacion de prospectos y clientes con confidencialidad.',
    '5. El uso fraudulento de enlaces, registros falsos o suplantacion ocasionara bloqueo inmediato del acceso.',
  ].join('\n'),
  referido: [
    'Al usar este panel como establecimiento aceptas las siguientes condiciones:',
    '',
    '1. Compartiras el enlace o material comercial autorizado de Chao Piojos con tus clientes.',
    '2. La informacion registrada debe ser veraz y corresponder a referidos reales del establecimiento.',
    '3. La liquidacion de valores o beneficios se realizara segun la configuracion vigente definida por la administracion.',
    '4. No esta permitido modificar la identidad visual, las condiciones comerciales o los mensajes oficiales sin autorizacion.',
    '5. El uso indebido del panel o el registro de informacion falsa podra causar la suspension del convenio y del acceso.',
  ].join('\n'),
};

export const TERMS_ROLE_LABELS = {
  piojologa: 'Piojologa',
  vendedor: 'Vendedor',
  referido: 'Establecimiento',
};

export const TERMS_ROLE_DESCRIPTIONS = {
  piojologa: 'Texto visible desde el panel operativo de la piojologa.',
  vendedor: 'Texto visible desde el panel comercial del vendedor.',
  referido: 'Texto visible desde el panel del establecimiento referido.',
};

export const getTermsByRole = (settings, role) => {
  if (!role) return '';
  return settings?.[role] || DEFAULT_TERMS_AND_CONDITIONS[role] || '';
};
