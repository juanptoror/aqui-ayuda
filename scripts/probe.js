// Probe Supabase REST API for existing tables using publishable key.
const BASE = 'https://ivnrelkbqqfebyullfeb.supabase.co';
const KEY = 'sb_publishable_v-vFcuJAXzD_hxFC_WKAHA_yzKLi3uQ';

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// Already-tried (all 404 PGRST205) — skip to avoid noise.
const TRIED = new Set(`ciudades centros necesidades inventario ofrecimientos voluntarios vehiculos transportes solicitudes perfiles ayudas publicaciones help helps requests offers needs items posts listings resources emergencies shelters volunteers deliveries acopio acopios puntos puntos_acopio recursos eventos organizaciones sedes brigadas tareas turnos campanas proyectos productos stock bodegas censo hogares danos beneficiarios entidades`.split(/\s+/));

// Big candidate dictionary — Spanish + English, singular + plural, snake variants.
const raw = `
donacion donaciones donation donations donante donantes donor donors
apadrinamiento apadrinamientos padrino padrinos sponsor sponsors sponsorship sponsorships
mercado mercados market markets mercado_solidario mercados_solidarios
kit kits kit_emergencia kits_emergencia kit_higiene kits_higiene
familia familias family families familia_afectada familias_afectadas afectado afectados afectada afectadas damnificado damnificados damnificada damnificadas
punto_encuentro puntos_encuentro punto_de_encuentro meeting_point meeting_points
agua aguas water alimento alimentos food foods comida comidas
refugio refugios shelter alojamiento alojamientos housing vivienda viviendas carpa carpas tienda tiendas
psicologo psicologos psychologist psychologists psicologia salud_mental
medico medicos doctor doctors medico_voluntario enfermero enfermeros nurse nurses
paramedico paramedicos primeros_auxilios first_aid
mascota mascotas pet pets animal animales animal_perdido animales_perdidos
perdido perdidos lost encontrado encontrados found desaparecido desaparecidos missing missing_person missing_persons
reporte reportes report reports reporte_dano reportes_dano incidencia incidencias incident incidents
alerta alertas alert alerts emergencia emergencias emergency notificacion notificaciones notification notifications
zona zonas zone zones zona_afectada zonas_afectadas affected_zone affected_zones
barrio barrios neighborhood neighborhoods comuna comunas vereda veredas municipio municipios
colegio colegios school schools escuela escuelas
iglesia iglesias church churches parroquia parroquias
fundacion fundaciones foundation foundations ong ongs
empresa empresas company companies negocio negocios business businesses
aliado aliados ally allies partner partners socio socios
patrocinador patrocinadores donante_empresa
cuenta cuentas account accounts cuenta_bancaria cuentas_bancarias bank_account bank_accounts
transferencia transferencias transfer transfers pago pagos payment payments
whatsapp contacto contactos contact contacts contacto_emergencia contactos_emergencia emergency_contact emergency_contacts
formulario formularios form forms respuesta respuestas response responses answer answers
usuario usuarios user users perfil perfiles profile profiles account_profile
persona personas person people ciudadano ciudadanos citizen citizens
registro registros registration registrations record records log logs
solicitud_ayuda solicitudes_ayuda help_request help_requests ayuda_solicitada
ofrecimiento oferta ofertas offer offering offerings donacion_ofrecida
categoria categorias category categories tipo tipos type types
estado estados state states status statuses estado_solicitud
ubicacion ubicaciones location locations direccion direcciones address addresses coordenada coordenadas
mensaje mensajes message messages chat chats conversacion conversaciones conversation conversations
comentario comentarios comment comments
imagen imagenes image images foto fotos photo photos archivo archivos file files media multimedia adjunto adjuntos attachment attachments
telefono telefonos phone phones
rol roles role permiso permisos permission permissions
equipo equipos team teams grupo grupos group groups
mision misiones mission missions operacion operaciones operation operations
ruta rutas route routes envio envios shipment shipments entrega entregas delivery
suministro suministros supply supplies provision provisiones
medicamento medicamentos medicine medicines medicamentos_donados
ropa clothes clothing prenda prendas garment garments
cobija cobijas blanket blankets colchon colchones mattress mattresses
higiene aseo panal panales diaper diapers
bebe bebes baby babies nino ninos nina ninas child children infante infantes
adulto adultos adulto_mayor adultos_mayores elderly anciano ancianos
discapacidad discapacidades disability disabilities discapacitado discapacitados
embarazada embarazadas pregnant
sangre blood donante_sangre donacion_sangre
albergue albergues punto_atencion puntos_atencion
brigada_medica brigadas_medicas rescate rescates rescue rescues rescatista rescatistas
bombero bomberos firefighter firefighters defensa_civil cruz_roja
gobierno alcaldia gobernacion secretaria secretarias
distribucion distribuciones distribution distributions
asignacion asignaciones assignment assignments
solicitante solicitantes requester requesters
beneficiario beneficiarios beneficiary beneficiaries recipient recipients
inventario_item inventario_items articulo articulos article articles
necesidad necesidades_urgentes urgente urgentes urgency urgencies priority priorities prioridad prioridades
donacion_dinero donacion_especie especie especies in_kind
voluntariado volunteering habilidad habilidades skill skills
disponibilidad disponibilidades availability availabilities horario horarios schedule schedules
tarea_voluntario tareas_voluntario
verificacion verificaciones verification verifications validacion validaciones validation
seguimiento seguimientos tracking historial historiales history histories
auditoria auditorias audit audits actividad actividades activity activities
config configuracion configuraciones setting settings ajuste ajustes
notificacion_push push_notification device dispositivo dispositivos device_token device_tokens
suscripcion suscripciones subscription subscriptions
encuesta encuestas survey surveys sondeo sondeos poll polls
evaluacion evaluaciones evaluation evaluations reseña resena resenas review reviews rating ratings valoracion valoraciones
donacion_monetaria fondo fondos fund funds recaudacion recaudaciones fundraising campaign campana
meta metas goal goals objetivo objetivos
estadistica estadisticas statistic statistics metrica metricas metric metrics dashboard
mapa mapas map maps marcador marcadores marker markers punto_mapa
sismo sismos earthquake earthquakes terremoto terremotos temblor temblores replica replicas aftershock aftershocks
magnitud epicentro sismologia
victima victimas victim victims fallecido fallecidos herido heridos injured
hospital hospitales clinica clinicas eps ips
donacion_item request_item offer_item
match matches emparejamiento emparejamientos
comunidad comunidades community communities
lider lideres leader leaders coordinador coordinadores coordinator coordinators
punto_recoleccion puntos_recoleccion collection_point collection_points recoleccion recolecciones
centro_acopio centros_acopio centro_ayuda centros_ayuda centro_atencion centros_atencion
donacion_pendiente donacion_recibida donacion_entregada
pereira dosquebradas armenia manizales caldas quindio risaralda eje_cafetero
app_user app_users public_user
`;

let cands = raw.split(/\s+/).filter(Boolean);
cands = [...new Set(cands)].filter(x => !TRIED.has(x));

async function probe(name) {
  const url = `${BASE}/rest/v1/${encodeURIComponent(name)}?select=*&limit=1`;
  try {
    const r = await fetch(url, { headers: H });
    const status = r.status;
    let body = '';
    try { body = await r.text(); } catch {}
    let code = null;
    try { const j = JSON.parse(body); code = j.code || null; } catch {}
    // interesting if not 404/PGRST205
    if (status !== 404 || (code && code !== 'PGRST205')) {
      return { name, status, code, body: body.slice(0, 300) };
    }
    return null;
  } catch (e) {
    return { name, status: 'ERR', code: null, body: String(e).slice(0, 200) };
  }
}

async function run() {
  console.log(`Probing ${cands.length} candidates...`);
  const found = [];
  const CONC = 25;
  for (let i = 0; i < cands.length; i += CONC) {
    const batch = cands.slice(i, i + CONC);
    const res = await Promise.all(batch.map(probe));
    for (const r of res) if (r) { found.push(r); console.log('HIT', JSON.stringify(r)); }
  }
  console.log('\n=== SUMMARY ===');
  console.log(`Total probed: ${cands.length}, hits: ${found.length}`);
  for (const f of found) console.log(`${f.status} ${f.code || ''} ${f.name}`);
}
run();
