"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { hydrateAttendee } from "@/lib/attendee-display";
import {
  MATCH_TABLE_INITIAL_VISIBLE,
  MATCH_TABLE_INTERSECTION_THRESHOLD,
  MATCH_TABLE_LOAD_MORE,
  MATCH_TABLE_ROOT_MARGIN,
} from "@/lib/match-table-scroll";
import type { AttendeeProfileBlob } from "@/lib/match-profile";
import {
  buildDisplayLabel,
  buildLiveSignal,
  buildStamps,
} from "@/lib/match-profile";
import type { Attendee, MatchWithAttendee } from "@/lib/types";
import {
  FREE_PREVIEW_ROWS,
  PAYWALL_BANNER_AFTER_RANK,
} from "@/lib/paywall";
import { PaywallBanner } from "./PaywallBanner";

const SHORTLIST_KEY = (slug: string) => `sideroom_shortlist_${slug}`;

export function getShortlist(slug: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SHORTLIST_KEY(slug)) || "[]");
  } catch {
    return [];
  }
}

function toggleShortlist(slug: string, id: string): string[] {
  const current = getShortlist(slug);
  const updated = current.includes(id)
    ? current.filter((x) => x !== id)
    : [...current, id];
  localStorage.setItem(SHORTLIST_KEY(slug), JSON.stringify(updated));
  return updated;
}

const FILTER_IDS = {
  founders: [
    "66b61a31-5b34-45c4-b19f-fe1e190052be", // Alba Castillo-Herbst
    "481a441c-b838-4c81-9360-94ed69136b2a", // Alba Fonseca Topp (also student)
    "2e01abc8-c722-4e0b-b675-bd3b97f4fe0b", // Alba Sotorra Clua
    "663d46cb-a3b6-46cd-86a3-adeda1553179", // Alex Nyberg
    "084e3d16-07ae-46cc-bcd4-5c852b2cd412", // Alfredo Gravagnuolo
    "1f50538d-5510-47cb-9f6e-19a49589678b", // Aly Toure
    "f6a00e60-8854-4dc9-b056-fd1ed7ed75ea", // Armine Movsesyan
    "4681eaeb-765a-4511-ab18-09c1a2974f07", // Christoph Karl Knoll
    "0dfbb963-5b58-4490-b341-95663b0924ea", // Corrado Orazi Barattieri (also student)
    "06fae18b-f662-4b95-b045-81a2ef436d24", // Carles Florensa (also investor)
    "09f5210c-8573-4e91-94d1-a0b628a9eb43", // Daniel Martinez
    "e92e85dd-951d-46c2-adcc-8a197f384449", // David Rehrl
    "2987d829-fdbc-45d8-b49b-4f868c1949c9", // Diana Abella
    "41aff3f4-38a0-4fbe-a91a-323c3a69b995", // Edoardo Goffi (also student)
    "1c474b0e-cc5c-411d-a9ea-af474cefee22", // Fabiola Barrios
    "019a4508-d633-47b5-add0-335100b46836", // Florence Depret
    "8d8b7c68-6ad1-43b0-8afe-71d4f69e14f2", // Jan Roca
    "9dd961d2-a8db-4033-8556-660a515713b9", // Janosch Willi
    "e1e8a938-cdcd-47d0-9bc3-43036f3b2e19", // Javier Vega Prieto (Cofundador & COO)
    "7f1b70b2-a021-4409-8c4e-dc2c27fe356e", // Jeremy Lin (also student)
    "8c290214-c087-46c0-af9e-72e3dca6a822", // Johanna Wagner (also student)
    "abf76135-fa47-4cf8-8bc0-e73edb42d716", // John Adewusi
    "08936322-f1ab-4077-831d-13de1347e017", // Johny Aguilar (also student)
    "90487070-f180-4b5b-b8ee-e1f233fc3c59", // Juliano Hauer
    "7078b381-a8e6-418d-8ab9-756c90727b7b", // Justina Klyviene
    "fef47f39-7665-4daf-9349-19309a105edc", // Kitti Szabo
    "886b78ee-dd31-460e-b107-b65a660f48b2", // Leon Heimann
    "3594ba4a-8712-4e90-bdfb-7a668b59b278", // Lorenzo Masiello
    "1d60bb60-211c-4686-ad9f-9002d23658c6", // Luciano Langenauer (also investor)
    "bc6d466a-7e32-408c-8a2e-9d153d85437c", // Luis Fernandez Lopez
    "2d7c1cc5-ea55-40d5-bf04-26e524a8867f", // Marc Bara
    "697c739f-332e-4eb8-bd2e-c832591b25bb", // Mareike Muller
    "1a4eb85c-25bd-41ad-8248-73ffe7f08365", // Matteo Zangla (also student)
    "2b0280a5-c8ef-42d7-a38f-a0d9cf668177", // Mustafa Taskaldiran
    "02beec71-ff65-4293-b9f9-3d156ce0bb9a", // Oleg Kovpak
    "47a5d5ba-b527-4601-9a94-ff64c6c1dc91", // Onur Ucuncu (also student)
    "bacba55d-1ba3-4f01-8dc3-65c719613643", // Suraj Kumar Lachmandas
    "8c9952dd-a1d1-4c4b-9f6c-89a3e19d1d57", // Tabithaleigh Allardice (also student)
    "5c50c7fa-c39f-4576-8afe-e5b4f96ec7df", // Tanguy Wincker
    "918f5e62-4131-4ff0-87db-2237198e0c90", // Thomas Komen
    "40abecf3-9fd2-48c3-bc7c-1969ddb8b774", // Borja Merino (also student)
  ],
  investors: [
    "41ab597d-fe13-42c8-ab0d-0146154bd66e", // Andrey Kostyuk - General Partner
    "1c3ecbaf-70b9-4423-a486-d275566bc7e4", // Justine Desardurats - Partner, Hervest Club
    "32de1f9b-2fad-47cf-bc14-8f7661ad011d", // Margherita Cielo - Investment Associate
    "06fae18b-f662-4b95-b045-81a2ef436d24", // Carles Florensa - Seed Angel (also founder)
    "4e61ed9e-09a9-4e1d-80ad-78b1de8fc0be", // Leonardo Calisse - Principal, Capital Formation
    "ebf1ac56-1344-4d4a-90e5-d3a1ef2f1a37", // Ines Cantarell - ESADE BAN Coordinator
    "649f1ea8-8ed3-4185-aa43-5505f8ba0977", // Danielle King - MBA, VC & M&A (also student)
    "1d60bb60-211c-4686-ad9f-9002d23658c6", // Luciano Langenauer - Balanced Investor Club (also founder)
    "5aa8e22c-5ca1-4331-a3d6-9a31bb43f230", // Andres Clares - Advisor, investor/board positioning
  ],
  executives: [
    "adab50d1-cc5d-4f40-bc65-5e45939dedc9", // Alberto Chillon - Head of EMEA, Stevanato
    "5354d26e-4155-4deb-a91a-3e7b3cb38285", // Alessio Fini - Head of Partnerships, Finanz
    "78d4c3a5-efb5-4748-b4ff-80b4fbe5063a", // Archie Cotterell - Accenture
    "45ab2b6e-e6cd-4f51-b31f-1722dddd1cc4", // Bianca Hasiandra - Justworks
    "ea9fe68e-7fd8-4525-beea-9b1fb934d6e2", // Catalina Varali - Latham & Watkins
    "d0c35949-27cd-4350-a0fc-fde08b247fab", // Cecilia Cosa - Senior Advisor, IDB
    "5f373699-365b-40c6-b584-c53569e6c336", // Chhaya Nathani - Adobe
    "e5927066-6034-4070-a061-174e5772862a", // Cristiano Tritarelli - J.JUAN
    "315333f9-c573-4cba-8819-2812c20558d8", // Cristina Chumillas - COO, Cambrico
    "2a23c3ca-0e99-4119-bde5-49bb90b0eab2", // Dan Anisimov - LLM-engineer, Optic
    "5768d743-3382-4e84-a04a-7be87d56fb82", // Daniele Santangelo - R&I Manager, Nexture
    "caa2c705-f8c2-45fc-b7e9-8c62100ae5f7", // David Pundt - Amazon
    "87483776-07bb-4278-9e05-866b3b584cd7", // David Ruana - Entrust
    "66d69c44-f37d-4911-bfe7-a2abf54edfa5", // Deepanshu Sehgal - Glovo
    "ec840c78-6597-41d9-89b8-7e3145560775", // Diana Apakidze - Trusted Carrier
    "11b32012-c1c5-48d5-aad5-bc6e093082dd", // Ema Menichelli - MSD
    "9f25c5e0-fde0-4ccf-9149-47382244da26", // Faisal Madani - PLANASA
    "f7ba6427-cd16-4cad-84a0-02dfe7b0b00e", // Folu Odedeji - BAT
    "6ee27820-b035-4421-a781-986bb470bc0b", // Francesc Saldana - Maximiza
    "ca91caa3-71ef-49b6-9e6a-b3f0da0ff076", // Gabi Munoz - Augmental
    "8df758bd-ab6b-4d83-b846-8ef20a96123e", // Jovana Todosijevic - CIBC
    "3c4916b2-abcd-4bf4-b13c-abc7650adcd3", // Luke Jahn - CFO, PostTag
    "f900a4a6-3e70-4cde-b55a-7f9c8458e8a1", // Mario Morales - PepsiCo
    "4e8cec87-8419-41ce-b28d-f960e7c4985a", // Maria Pousa - Impact Shakers
    "aa8657ed-915c-4e7b-8706-51eaf3619597", // Marius Ullrich - BELFOR
    "00fb5039-8c40-497f-8290-bf04a2e9f5f9", // Marta Sowinska - Merkle
    "0d319917-c876-419e-aca5-a64a59c33ed8", // Martina Colucci - Qmenta
    "48d3b312-3719-41c1-88aa-ee9bfea6c73c", // Maxim Polozkov - HSG
    "4e02bbbc-dc31-4b6c-a2c5-96880730e19f", // Massimiliano Menichelli - MSD
    "f81fd17e-76e7-45be-bedb-d336fc3c49a4", // Muriel Rodriguez - Netflix
    "5b8b969a-2a04-479c-a9d2-5434ad0e6a90", // Nes Ozkan - Rudiq
    "c2e51064-0bf9-4a65-9a1b-eaa968caf06d", // Noel Castillo Mateo - Autopistas
    "29b1c314-f279-4c5f-a178-9c1c466b4ec5", // Ori Perets - Marlink
    "d2261b86-cd44-41be-8238-8291178c5637", // Quentin Frecon - Decathlon
    "58b23623-dc95-4cfa-8164-c7a9e60aaba8", // Rocco Barone - Healthcare
    "3b7242b5-74b7-4d74-8fac-4a66c3a3558c", // Samuel Wood - Deloitte
    "0ca63e90-93d5-43b1-8f18-dfe730856dfe", // Sergio Abraham - AI Strategy Consultant
    "fe3243b2-8e35-4821-841f-38b8ff337c5e", // Veronika Schuler - SOPHiA GENETICS
    "10a893bc-df94-4e4b-aa8d-feefe175a18b", // Vittorio Colombo - Vedrai
    "945dbd59-e023-4156-81a2-05bfe76760f5", // Mikhail Podlas - Laspod
    "d5dca82d-f310-43bb-8c8f-95b8b40adf0f", // Simon Escapa - Qumotech
    "bf201d3e-1f4c-4ccd-b5a8-272a7b3ef6ee", // Susanna Ercolani - CGIAR
    "ce353970-52a1-454c-b9ff-053071ecc558", // Valeria Murolo - Atlante
    "61a17943-9ba4-4e20-a4df-a9c2d5fbb096", // Yuchen Hu - Big Huge Games
  ],
  students: [
    "4a667b30-081c-4be3-be99-d93e2f98132a", // Ana Alice Andrade
    "9fc527a5-8e92-4de0-b4ab-e3aa8783ce04", // Ana Laura Pacifico De Angelis
    "e10b26ac-f1e7-4418-a1a4-4d3071d8d840", // Animesh Vatsal
    "a7bb8109-65ba-4f89-880d-5133a3f81bfa", // Antonio Yutronic
    "ec957293-3471-41e0-92fb-b9e16cc4a00d", // Anna Herrera Moreu
    "04dbe59f-5c1d-4395-ae41-7c3a8678c907", // Cecilia Rentzsch
    "cc0be1ea-720b-44d6-ad4e-f3af6245416d", // Dafna Gorriti
    "649f1ea8-8ed3-4185-aa43-5505f8ba0977", // Danielle King (also investor)
    "15ba57bc-163d-48ac-9a61-91be0f711cc4", // Derek Hong-duc Tran
    "8694003c-7869-4467-b540-8555e2d8d7c2", // Dusan Lucic
    "4032ee2c-0577-4922-892f-d08cfec9d5fd", // Eddie Allbutt
    "ba7f1649-153e-4ba8-80e9-e9a8bce2d4d1", // Elena Arshakyan
    "01caacea-41c3-4297-8be8-2e3f6c59317f", // Eric Olson
    "2e4b43ac-a7db-4028-a102-bc95828dfe50", // Esteban Fabricio Gallardo
    "6da89248-9506-4e10-aa66-4bd5c26963e1", // Florian Knackstedt
    "59e5d519-3b17-4050-a69e-6ec75e343d62", // Florian Vogell
    "7418594d-09fc-485a-8bc8-6f3ee802c098", // Georgios Terzis
    "64615991-906d-46ed-995a-8db8d9edefe3", // Gregory Eastwood
    "da9d6861-680d-4f64-b879-cf78bc4b804a", // Guendalina Cassinelli
    "49b979d1-d3e5-495b-84f8-96370ba6441a", // Ivan Dundarov
    "8c352098-610f-43dc-80f0-b9c56a8e18d8", // Jakob Volbracht
    "fe8d5d0f-5809-4763-a933-5b3057589d0f", // Jamie Beetar
    "2a144fcc-d023-4cce-8fe5-a00b73e2319a", // Jaume Segura-Illa Valero
    "2e56c2e8-65c0-4aa1-a717-2dde9c943dc6", // Jomi Karske
    "7b378ecd-8ce7-47c6-a919-804446ee8a75", // Kitan David
    "fc886ece-a9c0-4148-8f0d-b567779d1b37", // Kavya Prem
    "71b8d062-64da-4bc1-9bcc-6170f7f1b0e2", // Khushi Agarwal
    "da22aac2-a321-4951-b06b-70f95ae283c0", // Laura Howe
    "6204b957-d213-42ac-9777-ea1f1b7a8bd2", // Linus Kettelhoit
    "100f4400-a339-43c5-b1e5-afd37e8b20d0", // Luca Melissari
    "693564d6-780f-44c3-b15f-8988c763bf4f", // Magdalena Gregorkiewicz
    "bc0f3db9-b9d5-4618-b862-d0458e3ccb0b", // Maria Jose Orejarena
    "7c33f076-1928-44c1-a627-4f9f43bf5fc1", // Marti Lombarte i Soler
    "49089aff-3991-4763-83c9-f90a204353b3", // Masha Gaspari
    "5b8a295f-6798-49d6-90b4-45065c1595e9", // Mark Zarybnicky
    "bc12deb5-1973-4e61-89b4-175d5079c7a8", // Matteo Antonini
    "288822ad-e1f3-4026-97bd-8935e710e4a8", // Mathis Stanitzke
    "d1b0d8c0-049e-4218-a9ec-0716d07ed557", // Mayur Tejwani
    "60f4d716-cc87-4a20-9ab5-bad656a43e6b", // Mir Riaz
    "d77008a9-5bba-4dd2-8ac6-c50f76ccd54e", // Monika Virmani
    "5aef1f17-4a79-45f9-a127-a7ada6aede19", // Moritz Gartner
    "2f3fbcb1-61b6-4793-805f-b35d7f0599a1", // Navid Mani
    "587ae0d7-93f4-49f3-ad81-ac648410c38b", // Navneeta Bhattacharjee
    "a4d09667-a002-4236-9f2f-84615c7b2fab", // Nick Wessel-Ellermann
    "e03b5a91-9b26-407a-8ff4-1b300772d88a", // Nicole Stump
    "c5c29794-9ca2-425c-89a0-0ef3dbc6875f", // Olivier Van Halewijn
    "ab656da9-c972-40a2-b755-140631adc494", // Pablo Gomez
    "f0576d0e-c0eb-4b37-8ad2-bebcabb63847", // Patrick Brunner
    "b664f30e-9330-4180-98ed-4f0de2c3fd79", // Pau Samblancat
    "0d8dea46-fa10-4ae4-972a-54f56abfce54", // Ramiro Rosas Cabrera
    "3683cc2b-9881-4e22-afdf-0ce29a03821e", // Robert Cheng
    "dc452bb7-67dc-4138-8b7f-ebf2362847b1", // Roberto Quintero De La Iglesia
    "a03813fb-2419-4533-a9c6-338348975f25", // Sasha Georges Geagea Diaz
    "cfc0b65c-a50f-440d-ba17-a62df4128781", // Satoshi Kiyomiya
    "c4afd5d7-68e4-4dba-86f7-b7ce1dd646b8", // Sovilla Dario
    "72c75b7a-4a73-482c-a1c6-7b5d877435a1", // Sven Adolph
    "11a68411-85cb-45e0-9669-f7e885241ae8", // Tadashi Watabe
    "4d88e90b-f770-4730-94e1-4587319a8a20", // Tarek Salom Rubio
    "1cefe6a4-21f6-4f67-95cb-4a6b9de572ac", // Tomas Barros
    "937958e4-a731-429c-bce8-9111a619bdcc", // Tudor Lina
    "839d8d96-bd2d-4135-8a76-af0841f4c3d1", // Vanderley Cirilo Junior
    "5005d5bc-b2f6-4414-8415-e721f9c0291d", // Victoria Monk
    "7dd95670-8cbf-4c62-b976-b51f20d3fa41", // Vincy Lu
    "285a77d4-a893-4b37-873c-dea0c0e145ab", // Wuraola Abulatan
    "2749854d-f87b-435d-b5cb-070712b43dde", // David Schlager
    // Student-founders: also in founders array
    "481a441c-b838-4c81-9360-94ed69136b2a", // Alba Fonseca Topp
    "0dfbb963-5b58-4490-b341-95663b0924ea", // Corrado Orazi Barattieri
    "41aff3f4-38a0-4fbe-a91a-323c3a69b995", // Edoardo Goffi
    "7f1b70b2-a021-4409-8c4e-dc2c27fe356e", // Jeremy Lin
    "8c290214-c087-46c0-af9e-72e3dca6a822", // Johanna Wagner
    "08936322-f1ab-4077-831d-13de1347e017", // Johny Aguilar
    "47a5d5ba-b527-4601-9a94-ff64c6c1dc91", // Onur Ucuncu
    "8c9952dd-a1d1-4c4b-9f6c-89a3e19d1d57", // Tabithaleigh Allardice
    "1a4eb85c-25bd-41ad-8248-73ffe7f08365", // Matteo Zangla
    "40abecf3-9fd2-48c3-bc7c-1969ddb8b774", // Borja Merino
  ],
} as const;

export type CategoryFilterChip = keyof typeof FILTER_IDS;

export type MatchFilterChip =
  | "all"
  | CategoryFilterChip
  | "shortlisted";

export function matchesFilterChip(
  row: MatchWithAttendee,
  chip: MatchFilterChip,
  shortlistIds: string[]
): boolean {
  const attendeeId = row.attendee_id;
  if (chip === "all") return true;
  if (chip === "shortlisted") return shortlistIds.includes(attendeeId);
  return (FILTER_IDS[chip] as readonly string[]).includes(attendeeId);
}

interface MatchTableProps {
  rows: MatchWithAttendee[];
  getRank: (attendeeId: string) => number;
  paid: boolean;
  eventSlug: string;
  totalCount: number;
  priceDisplay: string;
  checkoutLoading: boolean;
  onCheckout: () => void;
  onAccessCode?: () => void;
  suppressLockedRows?: boolean;
  onShortlistChange?: (ids: string[]) => void;
}

function formatTitleCompany(
  attendee: Attendee,
  profile: AttendeeProfileBlob | null
): string {
  const a = hydrateAttendee(attendee);
  const fromProfile = buildDisplayLabel(profile, a);
  if (fromProfile) return fromProfile;
  const title = a.title?.trim();
  const company = a.company?.trim();
  if (title && company) return `${title} · ${company}`;
  return title || company || "—";
}

function LinkedInIcon({ disabled }: { disabled?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function RowChevron({ expanded }: { expanded: boolean }) {
  return (
    <span
      className={`match-table-chevron ${expanded ? "match-table-chevron-down" : "match-table-chevron-right"}`}
      aria-hidden
    />
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="#C4842A"
        aria-hidden
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
      </svg>
    );
  }
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1C1208"
      strokeOpacity={0.4}
      strokeWidth="2"
      aria-hidden
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    </svg>
  );
}

function ContactCell({ attendee }: { attendee: Attendee }) {
  const a = hydrateAttendee(attendee);
  const hasLinkedIn = Boolean(a.linkedin_url);
  const hasEmail = Boolean(a.email);

  return (
    <div
      className="match-table-contact-icons"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {hasLinkedIn ? (
        <a
          href={a.linkedin_url!}
          target="_blank"
          rel="noopener noreferrer"
          className="match-table-icon-btn"
          aria-label={`LinkedIn — ${a.name}`}
        >
          <LinkedInIcon />
        </a>
      ) : (
        <span
          className="match-table-icon-btn disabled"
          aria-label="LinkedIn unavailable"
        >
          <LinkedInIcon disabled />
        </span>
      )}
      {hasEmail ? (
        <a
          href={`mailto:${a.email}`}
          className="match-table-icon-btn"
          aria-label={`Email — ${a.name}`}
        >
          <EmailIcon />
        </a>
      ) : (
        <span
          className="match-table-icon-btn disabled"
          aria-label="Email unavailable"
        >
          <EmailIcon />
        </span>
      )}
    </div>
  );
}

function tierLabelFromRow(row: MatchWithAttendee): "very_high" | "high" | "medium" | "low" {
  const t = row.tier;
  if (t === "very_high" || t === "high" || t === "medium" || t === "low") return t;
  const s = row.score ?? 0;
  if (s >= 90) return "very_high";
  if (s >= 70) return "high";
  if (s >= 45) return "medium";
  return "low";
}

function tierDisplayText(tier: string): string {
  if (tier === "very_high") return "Very\nHigh";
  if (tier === "high") return "High";
  if (tier === "medium") return "Medium";
  return "Low";
}

function tierStyle(tier: string): { text: string; dot: string } {
  if (tier === "very_high") return { text: "#1A7A3A", dot: "#22A84F" };
  if (tier === "high") return { text: "#1A6B2F", dot: "#2D8C45" };
  if (tier === "medium") return { text: "#8A7010", dot: "#C4A010" };
  return { text: "#7A5A08", dot: "#A87820" };
}

function DrawerLabel({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "var(--font-mono), monospace",
        fontSize: 9,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#8B7D5A",
        marginBottom: 10,
      }}
    >
      <span>{text}</span>
      <span
        aria-hidden
        style={{
          height: 1,
          background: "#C4B89A",
          flex: 1,
          opacity: 0.9,
        }}
      />
    </div>
  );
}

function MatchDrawer({
  matchReason,
  stamps,
}: {
  matchReason: string;
  stamps: string[];
}) {
  return (
    <div
      style={{
        background: "#EDE5D0",
        borderTop: "1px solid #C4B89A",
      }}
    >
      {stamps.length > 0 ? (
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #C4B89A",
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {stamps.map((stamp) => (
            <span
              key={stamp}
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 8,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                border: "1px solid #C4B89A",
                padding: "2px 6px",
                color: "#1C1208",
              }}
            >
              {stamp}
            </span>
          ))}
        </div>
      ) : null}

      <div
        style={{
          display: "block",
        }}
      >
        <div style={{ padding: "18px 16px", minWidth: 0 }}>
          <DrawerLabel text="Why this match" />
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-body), system-ui, sans-serif",
              fontSize: 12,
              lineHeight: 1.6,
              color: "#1C1208",
            }}
          >
            {matchReason}
          </p>
        </div>
      </div>
    </div>
  );
}

function LockedRow({
  rowNumber,
}: {
  rowNumber: number;
}) {
  return (
    <div
      className="match-table-row row-locked"
      style={{
        background: "#F5F0E6",
        border: "1px solid #C4B89A",
        marginBottom: 4,
        display: "flex",
        alignItems: "stretch",
        overflow: "hidden",
        filter: "blur(0.8px)",
        opacity: 0.9,
      }}
    >
      <div
        style={{
          minWidth: 110,
          borderRight: "1px solid #C4B89A",
          padding: "18px 14px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 9,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#8B7D5A",
          }}
        >
          Match
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#8B7D5A",
            whiteSpace: "pre-line",
          }}
        >
          Locked
        </span>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "#8B7D5A",
          }}
        />
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "stretch" }}>
        <div
          style={{
            flex: 1,
            borderRight: "1px solid #C4B89A",
            padding: "18px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-heading), serif",
              fontSize: 15,
              fontWeight: 600,
              color: "#1C1208",
            }}
          >
            #{rowNumber}
          </div>
          <div style={{ height: 10, background: "#EDE5D0", border: "1px solid #C4B89A" }} />
        </div>

        <div
          style={{
            flex: 2,
            borderRight: "1px solid #C4B89A",
            padding: "18px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#8B7D5A",
            }}
          >
            Locked
          </span>
          <span aria-hidden style={{ color: "#8B7D5A" }}>🔒</span>
        </div>

        <div
          style={{
            padding: "18px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderRight: "1px solid #C4B89A",
          }}
        >
          <span aria-hidden style={{ color: "#8B7D5A" }}>🔒</span>
          <span aria-hidden style={{ color: "#8B7D5A" }}>🔒</span>
        </div>

        <div
          style={{
            padding: "18px 14px",
            display: "flex",
            alignItems: "center",
            color: "#8B7D5A",
          }}
        >
          <span aria-hidden style={{ width: 14, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <RowChevron expanded={false} />
          </span>
        </div>
      </div>
    </div>
  );
}

function PaywallBannerRow({
  totalCount,
  priceDisplay,
  onCheckout,
  onAccessCode,
  loading,
}: {
  totalCount: number;
  priceDisplay: string;
  onCheckout: () => void;
  onAccessCode?: () => void;
  loading?: boolean;
}) {
  return (
    <div style={{ margin: "10px 0" }}>
      <PaywallBanner
        totalCount={totalCount}
        priceDisplay={priceDisplay}
        onCheckout={onCheckout}
        onAccessCode={onAccessCode}
        loading={loading}
      />
    </div>
  );
}

export function MatchTable({
  rows,
  getRank,
  paid,
  eventSlug,
  totalCount,
  priceDisplay,
  checkoutLoading,
  onCheckout,
  onAccessCode,
  suppressLockedRows,
  onShortlistChange,
}: MatchTableProps) {
  const rowsKey = useMemo(
    () => rows.map((r) => r.attendee_id).join(","),
    [rows]
  );

  return (
    <MatchTableInner
      key={rowsKey}
      rows={rows}
      getRank={getRank}
      paid={paid}
      eventSlug={eventSlug}
      totalCount={totalCount}
      priceDisplay={priceDisplay}
      checkoutLoading={checkoutLoading}
      onCheckout={onCheckout}
      onAccessCode={onAccessCode}
      suppressLockedRows={suppressLockedRows}
      onShortlistChange={onShortlistChange}
    />
  );
}

function MatchTableInner({
  rows,
  getRank,
  paid,
  eventSlug,
  totalCount,
  priceDisplay,
  checkoutLoading,
  onCheckout,
  onAccessCode,
  suppressLockedRows,
  onShortlistChange,
}: MatchTableProps) {
  const [visibleCount, setVisibleCount] = useState(MATCH_TABLE_INITIAL_VISIBLE);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShortlist(getShortlist(eventSlug));
  }, [eventSlug]);

  const handleToggleShortlist = useCallback(
    (attendeeId: string) => {
      const updated = toggleShortlist(eventSlug, attendeeId);
      setShortlist(updated);
      onShortlistChange?.(updated);
    },
    [eventSlug, onShortlistChange]
  );

  const cappedVisible = Math.min(visibleCount, rows.length);
  const hasMore = cappedVisible < rows.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) =>
      Math.min(prev + MATCH_TABLE_LOAD_MORE, rows.length)
    );
  }, [rows.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      {
        root: null,
        rootMargin: MATCH_TABLE_ROOT_MARGIN,
        threshold: MATCH_TABLE_INTERSECTION_THRESHOLD,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, cappedVisible]);

  const toggleRow = useCallback((attendeeId: string) => {
    setExpandedId((prev) => (prev === attendeeId ? null : attendeeId));
  }, []);

  const body = useMemo(() => {
    const nodes: ReactNode[] = [];
    let bannerInserted = paid;
    const visibleRows = rows.slice(0, cappedVisible);

    visibleRows.forEach((m, idx) => {
      const paywallRank = getRank(m.attendee_id);
      const rowNumber = idx + 1;
      const unlocked = paid || paywallRank <= FREE_PREVIEW_ROWS;
      const expanded = expandedId === m.attendee_id;

      if (unlocked) {
        const attendee = hydrateAttendee(m.attendee);
        const profile = m.profile ?? null;
        const tier = tierLabelFromRow(m);
        const tierColors = tierStyle(tier);
        const titleCompany = formatTitleCompany(attendee, profile);
        const stamps = buildStamps(profile);
        const signalText =
          buildLiveSignal(profile, attendee) || m.match_reason || "—";
        nodes.push(
          <div
            key={m.attendee_id}
            className={`match-table-row match-table-row-clickable ${expanded ? "row-expanded" : ""}`}
            onClick={() => toggleRow(m.attendee_id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleRow(m.attendee_id);
              }
            }}
            tabIndex={0}
            role="button"
            aria-expanded={expanded}
            style={{
              background: "#F5F0E6",
              border: "1px solid #C4B89A",
              marginBottom: 4,
              cursor: "pointer",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  minWidth: 110,
                  borderRight: "1px solid #C4B89A",
                  padding: "18px 14px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#8B7D5A",
                  }}
                >
                  Match
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: tierColors.text,
                    whiteSpace: "pre-line",
                    lineHeight: 1.15,
                  }}
                >
                  {tierDisplayText(tier)}
                </span>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: tierColors.dot,
                  }}
                />
              </div>

              <div
                style={{
                  flex: 1,
                  borderRight: "1px solid #C4B89A",
                  padding: "18px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-heading), serif",
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#1C1208",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {attendee.name}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-body), system-ui, sans-serif",
                    fontSize: 12,
                    color: "#8B7D5A",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {titleCompany}
                </div>
              </div>

              <div
                style={{
                  flex: 2,
                  padding: "18px 16px",
                  borderRight: "1px solid #C4B89A",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#8B7D5A",
                    marginBottom: 4,
                  }}
                >
                  Live signal
                </div>
                <div
                  className="match-table-signal"
                  style={{
                    fontFamily: "var(--font-body), system-ui, sans-serif",
                    fontSize: 12,
                    color: "#1C1208",
                    lineHeight: 1.5,
                    whiteSpace: "normal",
                    overflowWrap: "break-word",
                    wordBreak: "break-word",
                  }}
                >
                  {signalText}
                </div>
              </div>

              <div
                style={{
                  padding: "18px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  borderRight: "1px solid #C4B89A",
                }}
              >
                <ContactCell attendee={attendee} />
              </div>

              <div
                style={{
                  padding: "18px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  color: "#8B7D5A",
                }}
              >
                {paid ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleShortlist(m.attendee_id);
                    }}
                    aria-label={
                      shortlist.includes(m.attendee_id)
                        ? `Remove ${attendee.name} from shortlist`
                        : `Save ${attendee.name} to shortlist`
                    }
                    style={{
                      width: 32,
                      height: 32,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <BookmarkIcon filled={shortlist.includes(m.attendee_id)} />
                  </button>
                ) : null}
                <span
                  aria-hidden
                  style={{
                    width: 14,
                    height: 14,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 120ms ease",
                  }}
                >
                  <RowChevron expanded={expanded} />
                </span>
              </div>
            </div>

            {expanded ? (
              <MatchDrawer
                matchReason={m.match_reason}
                stamps={stamps}
              />
            ) : null}
          </div>
        );
      } else if (!suppressLockedRows) {
        nodes.push(
          <LockedRow key={m.attendee_id} rowNumber={rowNumber} />
        );
      }

      if (!paid && !bannerInserted && paywallRank === PAYWALL_BANNER_AFTER_RANK) {
        bannerInserted = true;
        nodes.push(
          <PaywallBannerRow
            key="paywall-banner"
            totalCount={totalCount}
            priceDisplay={priceDisplay}
            onCheckout={onCheckout}
            onAccessCode={onAccessCode}
            loading={checkoutLoading}
          />
        );
      }
    });

    if (
      !paid &&
      !bannerInserted &&
      (cappedVisible >= rows.length || suppressLockedRows) &&
      rows.some((m) => getRank(m.attendee_id) > FREE_PREVIEW_ROWS)
    ) {
      nodes.push(
        <PaywallBannerRow
          key="paywall-banner"
          totalCount={totalCount}
          priceDisplay={priceDisplay}
          onCheckout={onCheckout}
          onAccessCode={onAccessCode}
          loading={checkoutLoading}
        />
      );
    }

    return nodes;
  }, [
    rows,
    cappedVisible,
    getRank,
    paid,
    totalCount,
    priceDisplay,
    onCheckout,
    onAccessCode,
    checkoutLoading,
    expandedId,
    toggleRow,
    suppressLockedRows,
    shortlist,
    handleToggleShortlist,
  ]);

  return (
    <div className="match-table-wrap">
      <style>{`
        @media (max-width: 768px) {
          .match-table-wrap {
            width: 100%;
          }

          .match-table-row {
            background: #F5F0E6 !important;
            border: none !important;
            border-bottom: 1px solid #C4B89A !important;
            margin-bottom: 0 !important;
            border-radius: 0 !important;
          }

          .match-table-row.row-expanded {
            background: #EDE5D0 !important;
          }

          .match-table-row-clickable {
            padding: 14px 16px !important;
          }

          .match-table-row-clickable > div:first-child {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto auto !important;
            align-items: center !important;
            gap: 0 10px !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(1) {
            grid-column: 1 !important;
            grid-row: 1 !important;
            min-width: 0 !important;
            border-right: none !important;
            padding: 0 !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: flex-start !important;
            gap: 8px !important;
            margin-bottom: 10px !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(1) span:nth-child(1) {
            font-family: var(--font-mono), "DM Mono", monospace !important;
            font-size: 9px !important;
            color: #8B7D5A !important;
            text-transform: uppercase !important;
            letter-spacing: 0.08em !important;
            white-space: nowrap !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(1) span:nth-child(2) {
            font-family: var(--font-mono), "DM Mono", monospace !important;
            font-size: 11px !important;
            font-weight: 500 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.06em !important;
            line-height: 1 !important;
            white-space: normal !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(1) span:nth-child(3) {
            width: 8px !important;
            height: 8px !important;
            border-radius: 50% !important;
            flex-shrink: 0 !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(2) {
            grid-column: 1 / -1 !important;
            grid-row: 2 !important;
            border-right: none !important;
            padding: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 0 !important;
            margin-bottom: 10px !important;
            min-width: 0 !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(2) > div:nth-child(1) {
            font-family: var(--font-heading), "Playfair Display", serif !important;
            font-size: 15px !important;
            font-weight: 600 !important;
            color: #1C1208 !important;
            margin: 0 0 2px !important;
            overflow: visible !important;
            text-overflow: clip !important;
            white-space: normal !important;
            line-height: 1.25 !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(2) > div:nth-child(2) {
            font-family: var(--font-body), "DM Sans", system-ui, sans-serif !important;
            font-size: 12px !important;
            color: #8B7D5A !important;
            margin: 0 !important;
            overflow: visible !important;
            text-overflow: clip !important;
            white-space: normal !important;
            line-height: 1.35 !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(3) {
            grid-column: 1 / -1 !important;
            grid-row: 3 !important;
            border-right: none !important;
            padding: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 0 !important;
            min-width: 0 !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(3) > div:first-child {
            font-family: var(--font-mono), "DM Mono", monospace !important;
            font-size: 9px !important;
            text-transform: uppercase !important;
            color: #8B7D5A !important;
            letter-spacing: 0.08em !important;
            margin: 0 0 4px !important;
          }

          .match-table-signal {
            font-family: var(--font-body), "DM Sans", system-ui, sans-serif !important;
            font-size: 12px !important;
            color: #1C1208 !important;
            line-height: 1.55 !important;
            white-space: normal !important;
            overflow: visible !important;
            text-overflow: clip !important;
            overflow-wrap: anywhere !important;
            word-break: normal !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(4) {
            grid-column: 2 !important;
            grid-row: 1 !important;
            padding: 0 !important;
            border-right: none !important;
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
            margin-bottom: 10px !important;
          }

          .match-table-contact-icons {
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
          }

          .match-table-icon-btn {
            width: 28px !important;
            height: 28px !important;
            min-width: 28px !important;
            border: 1px solid #1C1208 !important;
            color: #1C1208 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            text-decoration: none !important;
          }

          .match-table-icon-btn.disabled {
            border-color: #C4B89A !important;
            color: #8B7D5A !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(5) {
            grid-column: 3 !important;
            grid-row: 1 !important;
            padding: 0 !important;
            display: flex !important;
            align-items: center !important;
            color: #8B7D5A !important;
            margin-bottom: 10px !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(5) > span {
            width: 14px !important;
            height: 14px !important;
            color: #8B7D5A !important;
            font-size: 14px !important;
            transition: transform 0.2s ease !important;
          }

          .match-table-row-clickable > div:first-child + div {
            max-height: 600px !important;
            overflow: hidden !important;
            transition: max-height 0.25s ease !important;
            background: transparent !important;
            border-top: 1px solid #C4B89A !important;
            margin-top: 14px !important;
            padding-top: 14px !important;
          }

          .match-table-row-clickable > div:first-child + div > div:first-child {
            padding: 0 !important;
            border-bottom: none !important;
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 5px !important;
            margin-bottom: 14px !important;
          }

          .match-table-row-clickable > div:first-child + div > div:first-child span {
            font-family: var(--font-mono), "DM Mono", monospace !important;
            font-size: 9px !important;
            color: #1C1208 !important;
            border: 1px solid #C4B89A !important;
            padding: 2px 6px !important;
            text-transform: uppercase !important;
            letter-spacing: 0.08em !important;
          }

          .match-table-row-clickable > div:first-child + div > div:nth-child(2) {
            display: flex !important;
            flex-direction: column !important;
            gap: 14px !important;
          }

          .match-table-row-clickable > div:first-child + div > div:nth-child(2) > div {
            padding: 0 !important;
            border-left: none !important;
            min-width: 0 !important;
          }

          .match-table-row-clickable > div:first-child + div > div:nth-child(2) > div:first-child {
            order: 1 !important;
          }

          .match-table-row-clickable > div:first-child + div > div:nth-child(2) > div:nth-child(2) {
            order: 3 !important;
          }

          .match-table-row-clickable > div:first-child + div > div:nth-child(2) p {
            font-family: var(--font-body), "DM Sans", system-ui, sans-serif !important;
            font-size: 12px !important;
            line-height: 1.6 !important;
            color: #1C1208 !important;
            margin: 0 !important;
          }

          .match-table-row-clickable > div:first-child + div > div:nth-child(2) > div > div:first-child {
            display: block !important;
            font-family: var(--font-mono), "DM Mono", monospace !important;
            font-size: 9px !important;
            text-transform: uppercase !important;
            color: #8B7D5A !important;
            letter-spacing: 0.08em !important;
            margin: 0 0 6px !important;
          }

          .match-table-row-clickable > div:first-child + div > div:nth-child(2) > div > div:first-child span + span {
            display: none !important;
          }

          .row-locked {
            padding: 14px 16px !important;
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
            filter: blur(0.8px) !important;
            overflow: hidden !important;
          }

          .row-locked > div:first-child {
            min-width: 0 !important;
            border-right: none !important;
            padding: 0 !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 8px !important;
          }

          .row-locked > div:nth-child(2) {
            flex: 1 !important;
            display: flex !important;
            align-items: center !important;
          }

          .row-locked > div:nth-child(2) > div:first-child {
            flex: 1 !important;
            border-right: none !important;
            padding: 0 !important;
          }

          .row-locked > div:nth-child(2) > div:first-child > div:first-child {
            font-family: var(--font-heading), "Playfair Display", serif !important;
            font-size: 15px !important;
            font-weight: 600 !important;
            color: #1C1208 !important;
          }

          .row-locked > div:nth-child(2) > div:first-child > div:nth-child(2) {
            height: 10px !important;
            max-width: 150px !important;
            margin-top: 5px !important;
          }

          .row-locked > div:nth-child(2) > div:nth-child(2),
          .row-locked > div:nth-child(2) > div:nth-child(3) {
            display: none !important;
          }

          .row-locked > div:nth-child(2) > div:nth-child(4) {
            margin-left: auto !important;
            padding: 0 !important;
            color: #8B7D5A !important;
            border-right: none !important;
            font-size: 16px !important;
          }

          .match-table-wrap > div > div[style*="margin: 10px 0"] {
            margin: 0 !important;
          }

          .match-table-wrap > div > div[style*="margin: 10px 0"] > * {
            width: 100% !important;
            background: #1C1208 !important;
            padding: 16px !important;
            text-align: center !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .match-table-wrap > div > div[style*="margin: 10px 0"] p,
          .match-table-wrap > div > div[style*="margin: 10px 0"] span {
            font-family: var(--font-mono), "DM Mono", monospace !important;
            font-size: 11px !important;
            color: #C4B89A !important;
            text-transform: uppercase !important;
            letter-spacing: 0.08em !important;
            line-height: 1.5 !important;
            margin: 0 0 10px !important;
          }

          .match-table-wrap > div > div[style*="margin: 10px 0"] button,
          .match-table-wrap > div > div[style*="margin: 10px 0"] a {
            font-family: var(--font-mono), "DM Mono", monospace !important;
            font-size: 11px !important;
            color: #F5F0E6 !important;
            background: #C4842A !important;
            border: none !important;
            padding: 10px 0 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.1em !important;
            width: 100% !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
      <div>{body}</div>
      {hasMore ? (
        <div
          ref={sentinelRef}
          className="match-table-sentinel-row"
          style={{
            padding: "16px 0",
            textAlign: "center",
          }}
        >
          <span className="font-mono-label match-table-sentinel-label">
            Loading more matches…
          </span>
        </div>
      ) : null}
    </div>
  );
}
