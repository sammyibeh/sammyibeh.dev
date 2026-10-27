/** Career history, newest first. Rendered by /experience and read by the site shell's `cat`. */
export const XP = [
  {
    id: 'gds',
    co: 'Government Digital Service (GDS)',
    role: 'Senior Developer',
    ref: '(HEAD → main)',
    when: 'Jan 2024 → present',
    place: 'London, UK',
    pts: ['Building and maintaining cross-government digital services, including GOV.UK One Login'],
  },
  {
    id: 'vidor',
    co: 'Vidor',
    role: 'Senior Software Engineer | CTO',
    when: 'Jun 2021 → Dec 2023',
    place: 'Delaware, USA',
    pts: [
      'Architected, implemented and shipped highly interactive customer-facing web and mobile applications',
      'Managed a team of software engineers and facilitated agile methodologies to ensure project success',
      'Migrated the company’s infrastructure to the cloud, improving scalability and reducing costs by 20%',
    ],
  },
  {
    id: 'xoxi',
    co: 'XOXI',
    role: 'Senior Software Engineer | CTO',
    when: 'Apr 2021 → Dec 2023',
    place: 'London, UK',
    pts: [
      'Led the development and implementation of a technology roadmap aligned with the company’s long-term goals',
      'Collaborated with cross-functional teams to optimise business processes and improve operational efficiency',
    ],
  },
  {
    id: 'farmsby',
    co: 'Farmsby',
    role: 'Lead, Software Engineer',
    when: 'Jul 2020 → Dec 2021',
    place: 'Lagos, Nigeria',
    pts: [
      'Wrote modern, performant, and robust code for a diverse array of client and internal projects',
      'Communicated and collaborated daily with engineers, designers, producers, clients, and stakeholders',
      'Engineered and maintained major features of Farmsby’s customer-facing web and mobile apps',
    ],
  },
  {
    id: 'itsync',
    co: 'ITSync Synergy',
    role: 'Head, Information Technology',
    when: 'Apr 2016 → Feb 2021',
    place: 'Lagos, Nigeria',
    pts: [
      'Created software solutions for banking, oil and gas, and medicine',
      'Set up business management solutions for startups, NGOs, and multinationals',
      'Built and scaled business systems and servers, including enterprise-grade services',
      'Implemented agile methodologies to improve delivery and cross-team collaboration',
      'Conducted technical due diligence for mergers and acquisitions and advised senior leadership',
    ],
  },
  {
    id: 'silicon-south',
    co: 'Silicon South Technologies',
    role: 'Software Engineer',
    when: 'Jan 2015 → Mar 2016',
    place: 'Port Harcourt, Nigeria',
    pts: [
      'Interfaced with clients weekly, providing technological expertise and knowledge',
      'Worked across whatever languages, frameworks and CMSs each client already ran',
    ],
  },
]

/** Seven-character "commit hash" for the git log view (djb2-style, stable across builds). */
export const hash = (s: string) => {
  let h = 5381
  for (const c of s) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0
  return h.toString(16).padStart(7, '0').slice(0, 7)
}
