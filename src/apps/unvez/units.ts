export interface UnitDef {
  id: string
  label: string
  symbol: string
  toBase: number
  kind?: string
  note?: string
}

export interface FamilyDef {
  id: string
  label: string
  baseId: string
  special?: 'temperature' | 'duration'
  units: UnitDef[]
}

export type CookConvention = 'us' | 'metric'

function cuisineUnits(cook: CookConvention): UnitDef[] {
  const us = cook === 'us'
  return [
    { id: 'ml', label: 'millilitre', symbol: 'ml', toBase: 1 },
    { id: 'cl', label: 'centilitre', symbol: 'cl', toBase: 10 },
    { id: 'l', label: 'litre', symbol: 'l', toBase: 1000 },
    { id: 'tsp', label: 'cuillère à café', symbol: 'tsp', toBase: us ? 4.92892 : 5, note: us ? 'US ≈ 4,93 ml' : 'métrique = 5 ml' },
    { id: 'tbsp', label: 'cuillère à soupe', symbol: 'tbsp', toBase: us ? 14.7868 : 15, note: us ? 'US ≈ 14,79 ml' : 'métrique = 15 ml' },
    { id: 'cup', label: 'tasse', symbol: 'cup', toBase: us ? 236.588 : 250, note: us ? 'US ≈ 236,6 ml (légale 240 ml)' : 'métrique = 250 ml' }
  ]
}

export function families(cook: CookConvention): FamilyDef[] {
  return [
    {
      id: 'distance',
      label: 'Distance',
      baseId: 'm',
      units: [
        { id: 'km', label: 'kilomètre', symbol: 'km', toBase: 1000 },
        { id: 'm', label: 'mètre', symbol: 'm', toBase: 1 },
        { id: 'dm', label: 'décimètre', symbol: 'dm', toBase: 0.1 },
        { id: 'cm', label: 'centimètre', symbol: 'cm', toBase: 0.01 },
        { id: 'mm', label: 'millimètre', symbol: 'mm', toBase: 0.001 },
        { id: 'um', label: 'micromètre', symbol: 'µm', toBase: 1e-6 },
        { id: 'mi', label: 'mile', symbol: 'mi', toBase: 1609.344 },
        { id: 'yd', label: 'yard', symbol: 'yd', toBase: 0.9144 },
        { id: 'ft', label: 'pied (foot)', symbol: 'ft', toBase: 0.3048 },
        { id: 'in', label: 'pouce (inch)', symbol: 'in', toBase: 0.0254 },
        { id: 'nmi', label: 'mille marin', symbol: 'nmi', toBase: 1852 }
      ]
    },
    {
      id: 'poids',
      label: 'Poids / masse',
      baseId: 'g',
      units: [
        { id: 'kg', label: 'kilogramme', symbol: 'kg', toBase: 1000 },
        { id: 'g', label: 'gramme', symbol: 'g', toBase: 1 },
        { id: 'mg', label: 'milligramme', symbol: 'mg', toBase: 0.001 },
        { id: 't', label: 'tonne', symbol: 't', toBase: 1e6 },
        { id: 'lb', label: 'livre', symbol: 'lb', toBase: 453.59237 },
        { id: 'oz', label: 'once', symbol: 'oz', toBase: 28.349523125 },
        { id: 'st', label: 'stone', symbol: 'st', toBase: 6350.29318 },
        { id: 'stick', label: 'stick de beurre', symbol: 'stick', toBase: 113.3981, note: 'stick US ≈ 113 g' }
      ]
    },
    {
      id: 'volume',
      label: 'Volume',
      baseId: 'l',
      units: [
        { id: 'l', label: 'litre', symbol: 'l', toBase: 1 },
        { id: 'ml', label: 'millilitre', symbol: 'ml', toBase: 0.001 },
        { id: 'cl', label: 'centilitre', symbol: 'cl', toBase: 0.01 },
        { id: 'm3', label: 'mètre cube', symbol: 'm³', toBase: 1000 },
        { id: 'galus', label: 'gallon US', symbol: 'gal US', toBase: 3.785411784 },
        { id: 'galuk', label: 'gallon UK', symbol: 'gal UK', toBase: 4.54609 },
        { id: 'ptus', label: 'pinte US', symbol: 'pt US', toBase: 0.473176473 },
        { id: 'floz', label: 'fluid ounce US', symbol: 'fl oz', toBase: 0.0295735295 }
      ]
    },
    {
      id: 'temperature',
      label: 'Température',
      baseId: 'c',
      special: 'temperature',
      units: [
        { id: 'c', label: 'degré Celsius', symbol: '°C', toBase: 1 },
        { id: 'f', label: 'degré Fahrenheit', symbol: '°F', toBase: 1, note: '°F = °C × 9/5 + 32' },
        { id: 'k', label: 'kelvin', symbol: 'K', toBase: 1, note: 'K = °C + 273,15' },
        { id: 'th', label: 'thermostat de four', symbol: 'th', toBase: 1, note: 'table gaz : th 4 = 180 °C' }
      ]
    },
    {
      id: 'surface',
      label: 'Surface',
      baseId: 'm2',
      units: [
        { id: 'm2', label: 'mètre carré', symbol: 'm²', toBase: 1 },
        { id: 'km2', label: 'kilomètre carré', symbol: 'km²', toBase: 1e6 },
        { id: 'ha', label: 'hectare', symbol: 'ha', toBase: 10000 },
        { id: 'acre', label: 'acre', symbol: 'acre', toBase: 4046.8564224 },
        { id: 'ft2', label: 'pied carré', symbol: 'ft²', toBase: 0.09290304 }
      ]
    },
    {
      id: 'vitesse',
      label: 'Vitesse',
      baseId: 'ms',
      units: [
        { id: 'ms', label: 'mètre par seconde', symbol: 'm/s', toBase: 1 },
        { id: 'kmh', label: 'kilomètre par heure', symbol: 'km/h', toBase: 1 / 3.6 },
        { id: 'mph', label: 'mile par heure', symbol: 'mph', toBase: 0.44704 },
        { id: 'nd', label: 'nœud', symbol: 'nd', toBase: 0.514444444 }
      ]
    },
    {
      id: 'duree',
      label: 'Durées',
      baseId: 's',
      special: 'duration',
      units: [
        { id: 's', label: 'seconde', symbol: 's', toBase: 1 },
        { id: 'min', label: 'minute', symbol: 'min', toBase: 60 },
        { id: 'h', label: 'heure', symbol: 'h', toBase: 3600 },
        { id: 'j', label: 'jour', symbol: 'j', toBase: 86400 },
        { id: 'sem', label: 'semaine', symbol: 'sem', toBase: 604800 },
        { id: 'an', label: 'année (365,25 j)', symbol: 'an', toBase: 31557600 }
      ]
    },
    {
      id: 'data',
      label: 'Données informatiques',
      baseId: 'o',
      units: [
        { id: 'bit', label: 'bit', symbol: 'bit', toBase: 0.125, kind: 'bit', note: '1 o = 8 bit' },
        { id: 'o', label: 'octet', symbol: 'o', toBase: 1 },
        { id: 'ko', label: 'kilooctet (décimal)', symbol: 'ko', toBase: 1e3, note: '×1000 o' },
        { id: 'mo', label: 'mégaoctet (décimal)', symbol: 'Mo', toBase: 1e6, note: '×1000 ko' },
        { id: 'go', label: 'gigaoctet (décimal)', symbol: 'Go', toBase: 1e9, note: '×1000 Mo' },
        { id: 'to', label: 'téraoctet (décimal)', symbol: 'To', toBase: 1e12, note: '×1000 Go' },
        { id: 'kib', label: 'kibioctet (binaire)', symbol: 'KiB', toBase: 1024, note: '×1024 o' },
        { id: 'mib', label: 'mébioctet (binaire)', symbol: 'MiB', toBase: 1024 ** 2, note: '×1024 KiB' },
        { id: 'gib', label: 'gibioctet (binaire)', symbol: 'GiB', toBase: 1024 ** 3, note: '×1024 MiB' },
        { id: 'tib', label: 'tébioctet (binaire)', symbol: 'TiB', toBase: 1024 ** 4, note: '×1024 GiB' },
        { id: 'bits', label: 'bit par seconde', symbol: 'bit/s', toBase: 0.125, kind: 'bit', note: 'débit : 1 o/s = 8 bit/s' },
        { id: 'os', label: 'octet par seconde', symbol: 'o/s', toBase: 1 },
        { id: 'kos', label: 'ko/s (décimal)', symbol: 'ko/s', toBase: 1e3, note: '×1000 o/s' },
        { id: 'mos', label: 'Mo/s (décimal)', symbol: 'Mo/s', toBase: 1e6 },
        { id: 'gos', label: 'Go/s (décimal)', symbol: 'Go/s', toBase: 1e9 }
      ]
    },
    {
      id: 'angles',
      label: 'Angles',
      baseId: 'rad',
      units: [
        { id: 'deg', label: 'degré', symbol: '°', toBase: Math.PI / 180 },
        { id: 'rad', label: 'radian', symbol: 'rad', toBase: 1 },
        { id: 'gon', label: 'grade', symbol: 'gon', toBase: Math.PI / 200 },
        { id: 'tour', label: 'tour', symbol: 'tour', toBase: 2 * Math.PI }
      ]
    },
    {
      id: 'cuisine',
      label: 'Cuisine',
      baseId: 'ml',
      units: cuisineUnits(cook)
    }
  ]
}

export function findFamily(familyId: string, cook: CookConvention): FamilyDef | undefined {
  return families(cook).find((f) => f.id === familyId)
}

export function findUnit(fam: FamilyDef, unitId: string): UnitDef | undefined {
  return fam.units.find((u) => u.id === unitId)
}

export function allUnits(cook: CookConvention): { fam: FamilyDef; unit: UnitDef }[] {
  return families(cook).flatMap((fam) => fam.units.map((unit) => ({ fam, unit })))
}
