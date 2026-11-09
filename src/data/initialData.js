// initialData.js - Initial state based on infobase and agency operations
import { DEMO_VUELOS_EMITIDOS } from './demoVuelos';

export const INITIAL_OPERADORES = [
  {
    id: 'aero',
    nombre: 'Aero',
    categoria: 'Aéreos',
    prestaciones: ['Aéreos'],
    descripcion: 'Operador especializado exclusivamente en pasajes aéreos regulares y charters. Emite tarifas netas por el total de pasajeros.',
    tiempoEsperaPromedio: '24 a 48 hs antes de emisión',
    contacto: 'operaciones@aero.tur.ar',
    badgeColor: 'badge-info'
  },
  {
    id: 'price',
    nombre: 'Price',
    categoria: 'Multiservicio',
    prestaciones: ['Hotel', 'Traslados', 'Asistencia al Viajero'],
    descripcion: 'Operador mayorista para reservas hoteleras, traslados privados/regulares y seguros de asistencia.',
    tiempoEsperaPromedio: 'Hasta 15 días antes del check-in o fecha de pago estipulada',
    contacto: 'reservas@price.com',
    badgeColor: 'badge-warning'
  },
  {
    id: 'azabache',
    nombre: 'Azabache',
    categoria: 'Multiservicio',
    prestaciones: ['Hotel', 'Traslados', 'Asistencia al Viajero'],
    descripcion: 'Consolidador mayorista con cupos confirmados y tarifas especiales en cadenas all-inclusive y destinos del Caribe y Sudamérica.',
    tiempoEsperaPromedio: 'Hasta fecha límite de prepago indicada en el voucher',
    contacto: 'grupos@azabache.com',
    badgeColor: 'badge-success'
  }
];

const COTIZACIONES_BASE = [
  {
    id: 'COT-2026-001',
    cliente: 'PELAO DAUD',
    emailCliente: 'pelao.daud@email.com',
    telefonoCliente: '+54 9 381 555-1234',
    destino: 'Tucumán / Caribe (TUC)',
    fechaViajeInicio: '2026-10-29',
    fechaViajeFin: '2026-11-07',
    fechaCotizacion: '2026-08-15',
    pax: 2,
    estado: 'Enviada', // Borrador, Enviada, Aceptada, Pagada, Vencida
    moneda: 'USD',
    comisionOptimaPct: 20, // 20%
    servicios: {
      aereo: {
        activo: true,
        nombre: 'Pasajes Aéreos Ida y Vuelta',
        proveedor: 'Aero',
        montoTotalNeto: 1600.88, // 800.44 + 800.44
        vencimientoTTOO: '2026-08-21',
        detalles: 'Vuelo con escala - Tarifa NO REEM (No reembolsable). H2.',
        politicaReembolso: 'NO REEM'
      },
      hotel: {
        activo: true,
        nombre: 'PRINCESS O.A.',
        proveedor: 'Price',
        montoTotalNeto: 1626.00,
        vencimientoTTOO: '2026-10-20',
        detalles: 'Habitación Doble Estándar - All Inclusive / H2',
        politicaReembolso: 'Reembolsable hasta vencimiento'
      },
      traslados: {
        activo: true,
        nombre: 'Traslados Aeropuerto - Hotel - Aeropuerto',
        proveedor: 'Price',
        montoTotalNeto: 0.00, // En la hoja figuraba 0.00
        vencimientoTTOO: '2026-10-20',
        detalles: 'Transfer regular in/out bonificado en paquete',
        politicaReembolso: 'Incluido'
      },
      asistencia: {
        activo: true,
        nombre: 'Asistencia al Viajero (AAVV)',
        proveedor: 'Price',
        montoTotalNeto: 60.00,
        vencimientoTTOO: '2026-10-20',
        detalles: 'Cobertura médica internacional 60k USD por pasajero',
        politicaReembolso: 'Cancelable sin cargo hasta 48hs antes'
      },
      extras: []
    },
    // En la hoja:
    // TN = 1600.88 + 1626.00 + 0 + 60 = 3286.88
    // COM = 1.20 -> TCOM = 3944.256 (~1972.13 x pax)
    // Precio de venta redondeado elegido: 1900.00 x pax = 3800.00
    // Ganancia real: 3800 - 3286.88 = 513.12
    precioVentaRedondeadoXPax: 1900.00,
    precioVentaTotalManual: 3800.00,
    notas: 'Cotización inicial enviada al cliente. Atención con el vencimiento de AERO el 21/08 para asegurar la tarifa.'
  },
  {
    id: 'COT-2026-002',
    cliente: 'FAMILIA MARTÍNEZ',
    emailCliente: 'martinez.viajes@gmail.com',
    telefonoCliente: '+54 9 11 4444-9876',
    destino: 'Cancún - Riu Palace Peninsula',
    fechaViajeInicio: '2026-11-15',
    fechaViajeFin: '2026-11-23',
    fechaCotizacion: '2026-09-02',
    pax: 4,
    estado: 'Aceptada',
    moneda: 'USD',
    comisionOptimaPct: 20,
    servicios: {
      aereo: {
        activo: true,
        nombre: 'Vuelos Buenos Aires - Cancún directos',
        proveedor: 'Aero',
        montoTotalNeto: 3400.00, // 850 x 4
        vencimientoTTOO: '2026-09-25',
        detalles: 'Vuelo directo Aerolíneas / Cupo confirmado',
        politicaReembolso: 'Tarifa flexible con penalidad'
      },
      hotel: {
        activo: true,
        nombre: 'Riu Palace Peninsula - Suite Familiar',
        proveedor: 'Azabache',
        montoTotalNeto: 3200.00,
        vencimientoTTOO: '2026-10-30',
        detalles: 'All Inclusive 24hs - 2 habitaciones comunicadas',
        politicaReembolso: 'Cancelación gratuita hasta 15 días antes'
      },
      traslados: {
        activo: true,
        nombre: 'Traslado privado van ejecutiva',
        proveedor: 'Azabache',
        montoTotalNeto: 180.00,
        vencimientoTTOO: '2026-10-30',
        detalles: 'Van privada exclusiva para el grupo familiar',
        politicaReembolso: 'Reembolsable'
      },
      asistencia: {
        activo: true,
        nombre: 'Asistencia al Viajero Premium Pax x4',
        proveedor: 'Azabache',
        montoTotalNeto: 160.00,
        vencimientoTTOO: '2026-10-30',
        detalles: 'Cobertura USD 150k + seguro de cancelación',
        politicaReembolso: 'Flexible'
      },
      extras: []
    },
    precioVentaRedondeadoXPax: 2150.00,
    precioVentaTotalManual: 8600.00,
    notas: 'Cliente confirmó la reserva y señó los aéreos. Resta pago del saldo hotel Azabache.'
  }
];

// Datos iniciales: las 2 cotizaciones base + 10 vuelos de ejemplo ya emitidos
// (repartidos en los distintos bloques de pago del mes en curso).
export const INITIAL_COTIZACIONES = [...COTIZACIONES_BASE, ...DEMO_VUELOS_EMITIDOS];

// Documentos organizados por cliente según la estructura de carpetas de Google Drive solicitada
export const INITIAL_CLIENT_DRIVE_FILES = {
  'PELAO DAUD': {
    cliente: 'PELAO DAUD',
    driveFolderUrl: 'https://drive.google.com/drive/folders/1_Pelao_Daud_JureFinance_Trip',
    carpetas: {
      viajeConcretado: {
        nombre: 'Viaje Concretado (Vouchers & Pasajes)',
        archivos: [
          {
            id: 'f-001',
            nombre: 'E-Ticket_Aero_Pelao_Daud_TUC_29OCT.pdf',
            tipo: 'pdf',
            tamanio: '1.4 MB',
            fechaModificacion: '2026-08-20',
            categoria: 'Aéreos',
            urlDescarga: '#',
            icono: 'FileText'
          },
          {
            id: 'f-002',
            nombre: 'Voucher_Hotel_Princess_OA_AllInclusive.pdf',
            tipo: 'pdf',
            tamanio: '820 KB',
            fechaModificacion: '2026-08-20',
            categoria: 'Hotel',
            urlDescarga: '#',
            icono: 'FileText'
          },
          {
            id: 'f-003',
            nombre: 'Voucher_Traslados_Price_In_Out.pdf',
            tipo: 'pdf',
            tamanio: '310 KB',
            fechaModificacion: '2026-08-20',
            categoria: 'Traslados',
            urlDescarga: '#',
            icono: 'FileText'
          },
          {
            id: 'f-004',
            nombre: 'Certificado_Asistencia_Viajero_Universal_60k.pdf',
            tipo: 'pdf',
            tamanio: '650 KB',
            fechaModificacion: '2026-08-20',
            categoria: 'Asistencia',
            urlDescarga: '#',
            icono: 'FileText'
          }
        ]
      },
      documentacionCliente: {
        nombre: 'Documentación Cliente (DNI & Pasaportes)',
        archivos: [
          {
            id: 'f-005',
            nombre: 'Pasaporte_Pelao_Daud_Titular.jpg',
            tipo: 'image',
            tamanio: '2.1 MB',
            fechaModificacion: '2026-08-14',
            categoria: 'Pasaporte',
            urlDescarga: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
            icono: 'Image'
          },
          {
            id: 'f-006',
            nombre: 'DNI_Pelao_Daud_Frente_y_Dorso.png',
            tipo: 'image',
            tamanio: '1.8 MB',
            fechaModificacion: '2026-08-14',
            categoria: 'DNI',
            urlDescarga: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80',
            icono: 'Image'
          },
          {
            id: 'f-007',
            nombre: 'Pasaporte_Acompaniante_Pax2.jpg',
            tipo: 'image',
            tamanio: '2.4 MB',
            fechaModificacion: '2026-08-14',
            categoria: 'Pasaporte',
            urlDescarga: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
            icono: 'Image'
          }
        ]
      }
    }
  },
  'FAMILIA MARTÍNEZ': {
    cliente: 'FAMILIA MARTÍNEZ',
    driveFolderUrl: 'https://drive.google.com/drive/folders/2_Fam_Martinez_JureFinance_Trip',
    carpetas: {
      viajeConcretado: {
        nombre: 'Viaje Concretado (Vouchers & Pasajes)',
        archivos: [
          {
            id: 'f-101',
            nombre: 'Boarding_Pass_Grupo_Martinez_Ezeiza_Cancun.pdf',
            tipo: 'pdf',
            tamanio: '2.8 MB',
            fechaModificacion: '2026-09-10',
            categoria: 'Aéreos',
            urlDescarga: '#',
            icono: 'FileText'
          },
          {
            id: 'f-102',
            nombre: 'Voucher_Reserva_Riu_Palace_Azabache.pdf',
            tipo: 'pdf',
            tamanio: '940 KB',
            fechaModificacion: '2026-09-10',
            categoria: 'Hotel',
            urlDescarga: '#',
            icono: 'FileText'
          }
        ]
      },
      documentacionCliente: {
        nombre: 'Documentación Cliente (DNI & Pasaportes)',
        archivos: [
          {
            id: 'f-103',
            nombre: 'Pasaportes_Titular_y_Familiares_Escaneo.pdf',
            tipo: 'pdf',
            tamanio: '4.6 MB',
            fechaModificacion: '2026-09-01',
            categoria: 'Pasaportes',
            urlDescarga: '#',
            icono: 'FileText'
          },
          {
            id: 'f-104',
            nombre: 'DNI_Hijos_Menores.jpg',
            tipo: 'image',
            tamanio: '1.9 MB',
            fechaModificacion: '2026-09-01',
            categoria: 'DNI',
            urlDescarga: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80',
            icono: 'Image'
          }
        ]
      }
    }
  }
};

// ============================================================
// Configuración Mensual de TTOs
// Cada proveedor define, a principio de mes, los bloques de fechas
// de emisión y su fecha límite de pago asociada. Se cargan a mano.
// Estructura: [{ mes: 'YYYY-MM', proveedorId, bloques: [{ desde, hasta, fechaPago }] }]
// ============================================================
/**
 * Plantilla de bloques de un mes: rango de días de emisión → fecha límite de pago.
 * Los bloques cuyo pago cae al mes siguiente usan el mes siguiente.
 */
export function buildBloquesMes(mes) {
  const [anio, mm] = mes.split('-').map(Number);
  const sig = new Date(anio, mm, 1);
  const mesSig = `${sig.getFullYear()}-${String(sig.getMonth() + 1).padStart(2, '0')}`;
  const dia = (m, d) => `${m}-${String(d).padStart(2, '0')}`;

  return [
    { desde: 1, hasta: 5, fechaPago: dia(mes, 20) },
    { desde: 6, hasta: 10, fechaPago: dia(mes, 25) },
    { desde: 11, hasta: 15, fechaPago: dia(mes, 28) },
    { desde: 16, hasta: 20, fechaPago: dia(mesSig, 5) },
    { desde: 21, hasta: 31, fechaPago: dia(mesSig, 10) }
  ];
}

/** Configuración mensual (todos los proveedores) para los meses indicados. */
export function buildConfiguracionMensual(meses = []) {
  return meses.flatMap((mes) =>
    ['aero', 'price', 'azabache'].map((proveedorId) => ({
      mes,
      proveedorId,
      bloques: buildBloquesMes(mes)
    }))
  );
}

const MES_ACTUAL = (() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
})();

export const INITIAL_CONFIGURACION_MENSUAL = buildConfiguracionMensual([MES_ACTUAL]);
