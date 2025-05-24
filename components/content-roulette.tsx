"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import {
  ArrowRight,
  Film,
  Loader2,
  Play,
  Tv,
  Star,
  Search,
  Filter,
  Heart,
  Shuffle,
  Volume2,
  VolumeX,
  Pause,
  Maximize,
  Home,
  Compass,
  Menu,
  ArrowLeft,
  BarChart3,
  User,
  Eye,
  PlayCircle,
  Loader2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { motion, AnimatePresence } from "framer-motion"

interface CastMember {
  id: number
  name: string
  character: string
  profile_path: string | null
}

interface ContentItem {
  id: number
  title: string
  description: string
  image: string
  backdrop: string | null
  categories: string[]
  year: number | string
  rating: number
  duration?: string
  seasons?: string
  trailer?: string | null
  cast: CastMember[]
  netflixUrl: string
  netflixId?: string
}

// Interface pour le cache
interface CacheItem {
  data: ContentItem
  timestamp: number
  detailsLoaded: boolean
}

export default function ContentRoulette() {
  const [contentType, setContentType] = useState<"movie" | "tv">("movie")
  const [category, setCategory] = useState<string>("all")
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [availableContent, setAvailableContent] = useState<ContentItem[]>([])
  const [isTrailerLoaded, setIsTrailerLoaded] = useState(false)
  const [userRatings, setUserRatings] = useState<{ [key: number]: number }>({})
  const [favorites, setFavorites] = useState<ContentItem[]>([])
  const [watchHistory, setWatchHistory] = useState<ContentItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<ContentItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [yearFilter, setYearFilter] = useState<string>("all")
  const [ratingFilter, setRatingFilter] = useState<string>("all")
  const [actorFilter, setActorFilter] = useState<string>("")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isTrailerPlaying, setIsTrailerPlaying] = useState(true)
  const [currentMode, setCurrentMode] = useState<"roulette" | "search" | "favorites" | "watched">("roulette")
  const [newReleasesItems, setNewReleasesItems] = useState<ContentItem[]>([])
  const [currentPage, setCurrentPage] = useState<"home" | "newReleases" | "browse" | "details">("home")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [browseContent, setBrowseContent] = useState<ContentItem[]>([])
  const [browsePage, setBrowsePage] = useState(1)
  const [hasMoreContent, setHasMoreContent] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [contentStats, setContentStats] = useState({ movies: 0, series: 0, dailyAdded: 0 })
  const [isUIHidden, setIsUIHidden] = useState(false)
  const [usedContentPool, setUsedContentPool] = useState<number[]>([])
  const [currentContentPool, setCurrentContentPool] = useState<ContentItem[]>([])
  const [watchedContent, setWatchedContent] = useState<ContentItem[]>([])

  // Nouveaux états pour les améliorations
  const [contentReady, setContentReady] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [lastClickTime, setLastClickTime] = useState(0)
  const [contentCache, setContentCache] = useState<{ [key: number]: CacheItem }>({})
  const [seenContentIds, setSeenContentIds] = useState<Set<number>>(new Set())
  const [isTransitioning, setIsTransitioning] = useState(false)

  // États pour le masquage automatique de l'UI
  const [mouseTimer, setMouseTimer] = useState<NodeJS.Timeout | null>(null)

  // États pour l'aléatoire infini
  const [contentPools, setContentPools] = useState<{ [key: string]: ContentItem[] }>({})
  const [currentPoolIndex, setCurrentPoolIndex] = useState(0)
  const [isLoadingNewPool, setIsLoadingNewPool] = useState(false)

  // États pour l'optimisation du chargement
  const [preloadedDetails, setPreloadedDetails] = useState<{ [key: number]: Partial<ContentItem> }>({})

  // Ajouter un nouvel état pour suivre si nous venons d'une recherche par acteur
  const [isActorSearch, setIsActorSearch] = useState(false)

  // Ajouter un état pour stocker le nom de l'acteur recherché
  const [searchedActorName, setSearchedActorName] = useState<string>("")
  // Ajouter un état pour stocker l'image de l'acteur recherché
  const [searchedActorImage, setSearchedActorImage] = useState<string | null>(null)

  // Add this state declaration near the other useState declarations:
  const [hoverTrailers, setHoverTrailers] = useState<{ [key: number]: boolean }>({})

  const { toast } = useToast()
  const trailerRef = useRef<HTMLIFrameElement>(null)
  const browseContainerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filmCategories = [
    { id: "infinite", name: "Infini" },
    { id: "all", name: "Tous les genres" },
    { id: "action", name: "Action" },
    { id: "comedy", name: "Comédie" },
    { id: "drama", name: "Drame" },
    { id: "horror", name: "Horreur" },
    { id: "scifi", name: "Science-Fiction" },
    { id: "romance", name: "Romance" },
    { id: "thriller", name: "Thriller" },
    { id: "adventure", name: "Aventure" },
    { id: "animation", name: "Animation" },
  ]

  const seriesCategories = [
    { id: "infinite", name: "Infini" },
    { id: "all", name: "Tous les genres" },
    { id: "drama", name: "Drame" },
    { id: "comedy", name: "Comédie" },
    { id: "thriller", name: "Thriller" },
    { id: "crime", name: "Crime" },
    { id: "documentary", name: "Documentaire" },
    { id: "action", name: "Action" },
    { id: "scifi", name: "Science-Fiction" },
    { id: "mystery", name: "Mystère" },
  ]

  // Années étendées de 1970 à 2025
  const yearOptions = [
    { value: "all", label: "Toutes les années" },
    { value: "2025", label: "2025" },
    { value: "2024", label: "2024" },
    { value: "2023", label: "2023" },
    { value: "2022", label: "2022" },
    { value: "2021", label: "2021" },
    { value: "2020", label: "2020" },
    { value: "2019", label: "2019" },
    { value: "2018", label: "2018" },
    { value: "2017", label: "2017" },
    { value: "2016", label: "2016" },
    { value: "2015", label: "2015" },
    { value: "2014", label: "2014" },
    { value: "2013", label: "2013" },
    { value: "2012", label: "2012" },
    { value: "2011", label: "2011" },
    { value: "2010", label: "2010" },
    { value: "2009", label: "2009" },
    { value: "2008", label: "2008" },
    { value: "2007", label: "2007" },
    { value: "2006", label: "2006" },
    { value: "2005", label: "2005" },
    { value: "2004", label: "2004" },
    { value: "2003", label: "2003" },
    { value: "2002", label: "2002" },
    { value: "2001", label: "2001" },
    { value: "2000", label: "2000" },
    { value: "1999", label: "1999" },
    { value: "1998", label: "1998" },
    { value: "1997", label: "1997" },
    { value: "1996", label: "1996" },
    { value: "1995", label: "1995" },
    { value: "1994", label: "1994" },
    { value: "1993", label: "1993" },
    { value: "1992", label: "1992" },
    { value: "1991", label: "1991" },
    { value: "1990", label: "1990" },
    { value: "1989", label: "1989" },
    { value: "1988", label: "1988" },
    { value: "1987", label: "1987" },
    { value: "1986", label: "1986" },
    { value: "1985", label: "1985" },
    { value: "1984", label: "1984" },
    { value: "1983", label: "1983" },
    { value: "1982", label: "1982" },
    { value: "1981", label: "1981" },
    { value: "1980", label: "1980" },
    { value: "1979", label: "1979" },
    { value: "1978", label: "1978" },
    { value: "1977", label: "1977" },
    { value: "1976", label: "1976" },
    { value: "1975", label: "1975" },
    { value: "1974", label: "1974" },
    { value: "1973", label: "1973" },
    { value: "1972", label: "1972" },
    { value: "1971", label: "1971" },
    { value: "1970", label: "1970" },
  ]

  const ratingOptions = [
    { value: "all", label: "Toutes les notes" },
    { value: "9", label: "9+ ⭐" },
    { value: "8", label: "8+ ⭐" },
    { value: "7", label: "7+ ⭐" },
    { value: "6", label: "6+ ⭐" },
    { value: "5", label: "5+ ⭐" },
    { value: "4", label: "4+ ⭐" },
  ]

  // Logo Netflix SVG
  const NetflixLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5.398 0v.006c3.028 8.556 5.37 15.175 8.348 23.596 2.344.058 4.85.398 4.854.398-2.8-7.924-5.923-16.747-8.487-24zm8.489 0v9.63L18.6 22.951c-.043-7.86-.004-15.913.002-22.95zM5.398 1.05V24c1.873-.225 2.81-.312 4.715-.398v-9.22z"
        fill="url(#netflix-gradient)"
      />
      <defs>
        <linearGradient id="netflix-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E50914" />
          <stop offset="100%" stopColor="#B81D24" />
        </linearGradient>
      </defs>
    </svg>
  )

  // Gestion du masquage/affichage de l'UI au clic
  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        setIsUIHidden(!isUIHidden)
      }
    },
    [isUIHidden],
  )

  // Fonction pour sauvegarder dans localStorage avec gestion d'erreur
  const saveToLocalStorage = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch (error) {
      console.error(`Erreur lors de la sauvegarde de ${key}:`, error)
    }
  }

  // Fonction pour charger depuis localStorage avec gestion d'erreur
  const loadFromLocalStorage = (key: string, defaultValue: any = null) => {
    try {
      const saved = localStorage.getItem(key)
      return saved ? JSON.parse(saved) : defaultValue
    } catch (error) {
      console.error(`Erreur lors du chargement de ${key}:`, error)
      return defaultValue
    }
  }

  // Gestion du cache local
  const getCachedContent = (id: number): CacheItem | null => {
    const cached = contentCache[id]
    if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
      // 30 minutes
      return cached
    }
    return null
  }

  const setCachedContent = (content: ContentItem, detailsLoaded = false) => {
    setContentCache((prev) => ({
      ...prev,
      [content.id]: {
        data: content,
        timestamp: Date.now(),
        detailsLoaded,
      },
    }))
  }
  

  // Gestion du masquage automatique de l'UI
const handleMouseMove = useCallback(() => {
  setIsUIHidden(false);

  if (mouseTimer) {
    clearTimeout(mouseTimer);
  }

  const newTimer = setTimeout(() => {
    setIsUIHidden(true);
  }, 6000); // Masquer après 60 secondes d'inactivité

  setMouseTimer(newTimer);
}, [mouseTimer]);

// Gestion du clic gauche pour masquer l'UI
const handleBackgroundLeftClick = useCallback(
  (e: React.MouseEvent) => {
    if (e.button === 0) { // Vérifie si le clic est un clic gauche
      if (e.target === e.currentTarget) {
        setIsUIHidden(true); // Masquer l'UI immédiatement
      }
    }
  },
  [isUIHidden],
);

// Gestion du clic gauche pour réafficher l'UI
const handleLeftClick = useCallback(
  (e: React.MouseEvent) => {
    if (e.button === 0) {
      // Clic gauche uniquement
      setIsUIHidden(false);
      handleMouseMove();
    }
  },
  [handleMouseMove],
);

  // Fonction pour précharger les détails d'un contenu
  const preloadContentDetails = async (content: ContentItem) => {
    if (preloadedDetails[content.id] || content.trailer) return

    try {
      const response = await fetch(`/api/content?type=${contentType}&id=${content.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.result) {
          setPreloadedDetails((prev) => ({
            ...prev,
            [content.id]: {
              trailer: data.result.trailer,
              cast: data.result.cast,
              duration: data.result.duration,
              netflixId: data.result.netflixId,
            },
          }))
        }
      }
    } catch (error) {
      console.warn("Erreur lors du préchargement:", error)
    }
  }

  // Fonction pour charger les détails complets d'un contenu
  
  const loadContentDetails = async (content: ContentItem): Promise<ContentItem> => {
    const cached = getCachedContent(content.id)
    if (cached && cached.detailsLoaded) {
      return cached.data
    }

    setIsLoadingDetails(true)
    try {
      const response = await fetch(`/api/content?type=${contentType}&id=${content.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.result) {
          const updatedContent = {
            ...content,
            trailer: data.result.trailer || null,
            cast: data.result.cast || content.cast,
            duration: data.result.duration || content.duration,
            netflixId: data.result.netflixId || content.netflixId,
          }

          // Mettre en cache avec détails complets
          setCachedContent(updatedContent, true)
          return updatedContent
        }
      }
    } catch (error) {
      console.warn("Erreur lors du chargement des détails:", error)
    } finally {
      setIsLoadingDetails(false)
    }

    return content
  }

  // Fonction pour charger un nouveau pool de contenu
  const loadNewContentPool = async (poolKey: string) => {
    if (contentPools[poolKey] && contentPools[poolKey].length > 0) {
      // Filtrer les contenus déjà vus même dans le cache
      const unseenFromCache = contentPools[poolKey].filter(
        (item) =>
          !seenContentIds.has(item.id) &&
          !watchedContent.some((watched) => watched.id === item.id) &&
          !watchHistory.some((history) => history.id === item.id),
      )

      if (unseenFromCache.length > 5) {
        return unseenFromCache
      }
    }

    setIsLoadingNewPool(true)
    try {
      const promises = []
      // Charger plus de pages pour avoir plus de choix
      for (let i = 0; i < 5; i++) {
        const randomPage = Math.floor(Math.random() * 100) + 1 // Augmenter la plage de pages
        let url = `/api/content?type=${contentType}&genre=${category}&page=${randomPage}&limit=20`

        if (yearFilter !== "all") url += `&year=${yearFilter}`
        if (ratingFilter !== "all") url += `&rating=${ratingFilter}`
        if (actorFilter.trim()) url += `&actor=${encodeURIComponent(actorFilter)}`

        // Ajouter un délai entre les requêtes
        await new Promise((resolve) => setTimeout(resolve, 200 * i))
        promises.push(fetch(url))
      }

      const responses = await Promise.all(promises)
      const dataPromises = responses.map((response) => response.json())
      const allData = await Promise.all(dataPromises)

      let allResults: ContentItem[] = []
      allData.forEach((data) => {
        if (data.success && data.results) {
          allResults = [...allResults, ...data.results]
        }
      })

      // Éliminer les doublons et filtrer STRICTEMENT les contenus jamais vus
      const uniqueResults = Array.from(new Map(allResults.map((item) => [item.id, item])).values())
      const neverSeenResults = uniqueResults.filter(
        (item) =>
          !seenContentIds.has(item.id) &&
          !watchedContent.some((watched) => watched.id === item.id) &&
          !watchHistory.some((history) => history.id === item.id),
      )

      const shuffledResults = neverSeenResults.sort(() => Math.random() - 0.5)

      setContentPools((prev) => ({
        ...prev,
        [poolKey]: shuffledResults,
      }))

      // Précharger les détails des premiers éléments
      shuffledResults.slice(0, 3).forEach((content) => {
        preloadContentDetails(content)
      })

      setIsLoadingNewPool(false)
      return shuffledResults
    } catch (error) {
      console.error("Erreur lors du chargement du pool:", error)
      setIsLoadingNewPool(false)
      return []
    }
  }

  // Fonction améliorée pour obtenir un contenu aléatoire vraiment infini sans répétition
  const getRandomContentInfinite = async () => {
    // Vérifier le délai minimum entre les clics
    const now = Date.now()
    if (now - lastClickTime < 500) {
      return
    }
    setLastClickTime(now)

    const poolKey = `${contentType}-${category}-${yearFilter}-${ratingFilter}-${actorFilter}-${currentPoolIndex}`
    let pool = contentPools[poolKey]

    if (!pool || pool.length === 0) {
      pool = await loadNewContentPool(poolKey)
    }

    if (pool.length === 0) {
      toast({
        title: "Aucun contenu disponible",
        description: "Impossible de charger plus de contenu.",
        variant: "destructive",
      })
      return
    }
    console.log(`

• ▌ ▄ ·.  ▄▄▄· ▄▄▌  ▄▄▄▄· ▄▄▄         ▄· ▄▌▄▄▄ .
·██ ▐███▪▐█ ▀█ ██•  ▐█ ▀█▪▀▄ █·▪     ▐█▪██▌▀▄.▀·
▐█ ▌▐▌▐█·▄█▀▀█ ██▪  ▐█▀▀█▄▐▀▀▄  ▄█▀▄ ▐█▌▐█▪▐▀▀▪▄
██ ██▌▐█▌▐█ ▪▐▌▐█▌▐▌██▄▪▐█▐█•█▌▐█▌.▐▌ ▐█▀·.▐█▄▄▌
▀▀  █▪▀▀▀ ▀  ▀ .▀▀▀ ·▀▀▀▀ .▀  ▀ ▀█▄▀▪  ▀ •  ▀▀▀ 
by Malbroye Studio
Welcome to Netflix Roulette!  
Enjoy the show! 🎬🍿
  `)

    // Filtrer STRICTEMENT les contenus jamais vus et jamais utilisés
    const neverSeenChoices = pool.filter(
      (item) =>
        !seenContentIds.has(item.id) &&
        !usedContentPool.includes(item.id) &&
        !watchedContent.some((watched) => watched.id === item.id) &&
        !watchHistory.some((history) => history.id === item.id),
    )

    // Si aucun contenu jamais vu, charger un nouveau pool
    if (neverSeenChoices.length === 0) {
      setCurrentPoolIndex((prev) => prev + 1)
      setUsedContentPool([]) // Réinitialiser le pool utilisé

      // Essayer de charger plusieurs nouveaux pools jusqu'à trouver du contenu inédit
      for (let attempt = 0; attempt < 5; attempt++) {
        const nextPoolKey = `${contentType}-${category}-${yearFilter}-${ratingFilter}-${actorFilter}-${currentPoolIndex + 1 + attempt}`
        const newPool = await loadNewContentPool(nextPoolKey)

        const freshChoices = newPool.filter(
          (item) =>
            !seenContentIds.has(item.id) &&
            !watchedContent.some((watched) => watched.id === item.id) &&
            !watchHistory.some((history) => history.id === item.id),
        )

        if (freshChoices.length > 0) {
          const randomIndex = Math.floor(Math.random() * freshChoices.length)
          const newSelection = freshChoices[randomIndex]
          await selectContentWithPreload(newSelection)
          return
        }
      }

      // Si vraiment aucun contenu inédit trouvé, proposer de réinitialiser
      toast({
        title: "Plus de nouveaux contenus",
        description: "Vous avez vu tous les contenus disponibles ! Réinitialisez l'historique pour recommencer.",
        variant: "destructive",
      })
      return
    }

    // Sélectionner aléatoirement parmi les contenus jamais vus
    const randomIndex = Math.floor(Math.random() * neverSeenChoices.length)
    const newSelection = neverSeenChoices[randomIndex]
    await selectContentWithPreload(newSelection)
  }

  // Fonction pour sélectionner un contenu avec préchargement
  const selectContentWithPreload = async (content: ContentItem) => {
    setContentReady(false)
    setIsLoading(true)

    // Vérifier le cache d'abord
    const cached = getCachedContent(content.id)
    let finalContent = content

    if (cached && cached.detailsLoaded) {
      finalContent = cached.data
    } else {
      // Charger les détails complets
      finalContent = await loadContentDetails(content)
    }

    // Ne pas effacer selectedContent pendant le chargement pour éviter le popup
    // setSelectedContent(finalContent) - on le fait après
    setIsTrailerLoaded(false)

    // Ajouter aux contenus vus
    setSeenContentIds((prev) => new Set([...prev, finalContent.id]))

    // Ajouter au pool utilisé
    setUsedContentPool((prev) => {
      const newPool = [finalContent.id, ...prev].slice(0, 100) // Garder 100 derniers
      return newPool
    })

    setIsLoading(false)

    // Maintenant on peut changer le contenu
    setSelectedContent(finalContent)

    // Attendre un peu avant d'afficher le contenu pour s'assurer que tout est chargé
    setTimeout(() => {
      setContentReady(true)
    }, 500)
  }

  // Fonction améliorée pour le scroll infini dans Explorer
  const fetchBrowseContentInfinite = async (page: number) => {
    if (page === 1) {
      setBrowseContent([])
      setBrowsePage(1)
      setHasMoreContent(true)
    }

    setIsLoadingMore(true)
    try {
      // Réduire le nombre de pages chargées en parallèle
      const pagesToLoad = page === 1 ? [1] : [page]
      let allResults: ContentItem[] = []

      // Charger les pages séquentiellement plutôt qu'en parallèle
      for (const pageNum of pagesToLoad) {
        let url = `/api/content?type=${contentType}&page=${pageNum}&limit=20`
        if (category !== "all") url += `&genre=${category}`
        if (yearFilter !== "all") url += `&year=${yearFilter}`
        if (ratingFilter !== "all") url += `&rating=${ratingFilter}`
        if (actorFilter.trim()) url += `&actor=${encodeURIComponent(actorFilter)}`

        try {
          const response = await fetch(url)
          const data = await response.json()

          if (data.success && data.results) {
            allResults = [...allResults, ...data.results]
          }

          // Ajouter un délai entre les requêtes
          if (pagesToLoad.length > 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000))
          }
        } catch (error) {
          console.error(`Erreur lors de la récupération de la page ${pageNum}:`, error)
          // Continuer avec les autres pages même si une échoue
        }
      }

      // Éliminer les doublons
      const uniqueResults = Array.from(new Map(allResults.map((item) => [item.id, item])).values())

      // Mélanger les résultats de manière aléatoire à chaque chargement
      const shuffledResults = uniqueResults.sort(() => Math.random() - 0.5)

      if (page === 1) {
        setBrowseContent(shuffledResults)
      } else {
        setBrowseContent((prev) => {
          const combined = [...prev, ...shuffledResults]
          return Array.from(new Map(combined.map((item) => [item.id, item])).values())
        })
      }

      setBrowsePage(page + 1)
      setHasMoreContent(uniqueResults.length >= 20)
    } catch (error) {
      console.error("Erreur lors de la récupération du contenu browse:", error)
      toast({
        title: "Erreur de chargement",
        description: "Impossible de charger plus de contenu. Veuillez réessayer plus tard.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingMore(false)
    }
  }

  // Charger les données depuis le localStorage au démarrage
  useEffect(() => {
    const savedFavorites = loadFromLocalStorage("netflix-roulette-favorites", [])
    const savedRatings = loadFromLocalStorage("netflix-roulette-ratings", {})
    const savedHistory = loadFromLocalStorage("netflix-roulette-history", [])
    const savedMuted = loadFromLocalStorage("netflix-roulette-muted", false)
    const savedCache = loadFromLocalStorage("netflix-roulette-cache", {})
    const savedSeenIds = loadFromLocalStorage("netflix-roulette-seen", [])
    const savedWatched = loadFromLocalStorage("netflix-roulette-watched", [])

    setFavorites(savedFavorites)
    setUserRatings(savedRatings)
    setWatchHistory(savedHistory)
    setIsMuted(savedMuted)
    setContentCache(savedCache)
    setSeenContentIds(new Set(savedSeenIds))
    setWatchedContent(savedWatched)

    // Charger le contenu initial
    fetchContent()
    fetchNewReleases()
    fetchBrowseContent(1)
    fetchContentStats()
  }, [])

  // Sauvegarder automatiquement les favoris
  useEffect(() => {
    saveToLocalStorage("netflix-roulette-favorites", favorites)
  }, [favorites])

  // Sauvegarder automatiquement les notes
  useEffect(() => {
    saveToLocalStorage("netflix-roulette-ratings", userRatings)
  }, [userRatings])

  // Sauvegarder automatiquement l'historique
  useEffect(() => {
    saveToLocalStorage("netflix-roulette-history", watchHistory)
  }, [watchHistory])

  // Sauvegarder automatiquement le statut audio
  useEffect(() => {
    saveToLocalStorage("netflix-roulette-muted", isMuted)
  }, [isMuted])

  // Sauvegarder automatiquement le cache
  useEffect(() => {
    saveToLocalStorage("netflix-roulette-cache", contentCache)
  }, [contentCache])

  // Sauvegarder automatiquement les IDs vus
  useEffect(() => {
    saveToLocalStorage("netflix-roulette-seen", Array.from(seenContentIds))
  }, [seenContentIds])

  // Sauvegarder automatiquement les contenus vus
  useEffect(() => {
    saveToLocalStorage("netflix-roulette-watched", watchedContent)
  }, [watchedContent])

  // Event listeners pour le masquage automatique de l'UI
  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container.addEventListener("mousemove", handleMouseMove)

      return () => {
        container.removeEventListener("mousemove", handleMouseMove)
        if (mouseTimer) {
          clearTimeout(mouseTimer)
        }
      }
    }
  }, [handleMouseMove, handleLeftClick, mouseTimer])

  // Fonction pour récupérer les statistiques réelles depuis TMDb
  const fetchContentStats = async () => {
    try {
      const [moviesResponse, seriesResponse] = await Promise.all([
        fetch(`/api/content?type=movie&page=1&limit=1`),
        fetch(`/api/content?type=tv&page=1&limit=1`),
      ])

      const [moviesData, seriesData] = await Promise.all([moviesResponse.json(), seriesResponse.json()])

      setContentStats({
        movies: moviesData.total || 0,
        series: seriesData.total || 0,
        dailyAdded: Math.floor(Math.random() * 10) + 1,
      })
    } catch (error) {
      console.error("Erreur lors de la récupération des statistiques:", error)
      setContentStats({
        movies: 0,
        series: 0,
        dailyAdded: 0,
      })
    }
  }

  const fetchNewReleases = async () => {
    try {
      setIsLoading(true)
      const now = new Date()
      const twoWeeksAgo = new Date(now)
      twoWeeksAgo.setDate(now.getDate() - 15)

      const endDate = now.toISOString().split("T")[0]
      const startDate = twoWeeksAgo.toISOString().split("T")[0]

      // Réduire à une seule requête au lieu de 3
      const url = `/api/content?type=${contentType}&sort_by=release_date.desc&limit=20&date_range=${startDate},${endDate}&page=1`
      const response = await fetch(url)
      const data = await response.json()

      let allResults: ContentItem[] = []
      if (data.success && data.results) {
        allResults = [...data.results]
      }

      if (allResults.length > 0) {
        const uniqueResults = Array.from(new Map(allResults.map((item) => [item.id, item])).values())
        const shuffledResults = uniqueResults.sort(() => Math.random() - 0.5)
        setNewReleasesItems(shuffledResults.slice(0, 20))
      } else {
        const fallbackUrl = `/api/content?type=${contentType}&sort_by=popularity.desc&limit=20`
        const fallbackResponse = await fetch(fallbackUrl)
        const fallbackData = await fallbackResponse.json()

        if (fallbackData.success) {
          setNewReleasesItems(fallbackData.results)
        }
      }
      setIsLoading(false)
    } catch (error) {
      console.error("Erreur lors de la récupération des nouveautés:", error)
      setIsLoading(false)
      toast({
        title: "Erreur",
        description: "Impossible de charger les nouveautés. Veuillez réessayer plus tard.",
        variant: "destructive",
      })
    }
  }

  // Scroll infini pour la page browse
  const handleScroll = useCallback(() => {
    if (!browseContainerRef.current || isLoadingMore || !hasMoreContent) return

    const { scrollTop, scrollHeight, clientHeight } = browseContainerRef.current
    if (scrollTop + clientHeight >= scrollHeight - 1000) {
      fetchBrowseContent(browsePage + 1)
    }
  }, [browsePage, isLoadingMore, hasMoreContent])

  useEffect(() => {
    const container = browseContainerRef.current
    if (container) {
      container.addEventListener("scroll", handleScroll)
      return () => container.removeEventListener("scroll", handleScroll)
    }
  }, [handleScroll])

  const fetchContent = async () => {
    setIsLoading(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 300))

      const promises = []
      const randomPages = []

      for (let i = 0, iLen = 3; i < iLen; i++) {
        const randomPage = Math.floor(Math.random() * 20) + 1
        if (!randomPages.includes(randomPage)) {
          randomPages.push(randomPage)
        }
      }

      for (const page of randomPages) {
        let url = `/api/content?type=${contentType}&genre=${category}&page=${page}&limit=20`

        if (yearFilter !== "all") url += `&year=${yearFilter}`
        if (ratingFilter !== "all") url += `&rating=${ratingFilter}`
        if (actorFilter.trim()) url += `&actor=${encodeURIComponent(actorFilter)}`

        promises.push(fetch(url))
      }

      const responses = await Promise.all(promises)
      const dataPromises = responses.map((response) => response.json())
      const allData = await Promise.all(dataPromises)

      let allResults: ContentItem[] = []
      allData.forEach((data) => {
        if (data.success && data.results) {
          allResults = [...allResults, ...data.results]
        }
      })

      if (allResults.length > 0) {
        const uniqueResults = Array.from(new Map(allResults.map((item) => [item.id, item])).values())
        const shuffledResults = uniqueResults.sort(() => Math.random() - 0.5)

        setAvailableContent(shuffledResults)
        setCurrentContentPool(shuffledResults)

        // Filtrer les contenus non vus
        const unseenResults = shuffledResults.filter((item) => !seenContentIds.has(item.id))
        const choicesPool = unseenResults.length > 5 ? unseenResults : shuffledResults

        if (choicesPool.length > 0) {
          const randomIndex = Math.floor(Math.random() * choicesPool.length)
          const newSelection = choicesPool[randomIndex]

          await selectContentWithPreload(newSelection)
        }
      } else {
        setSelectedContent(null)
        toast({
          title: "Aucun contenu trouvé",
          description: "Essayez avec d'autres filtres.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Erreur:", error)
      toast({
        title: "Erreur",
        description: `Impossible de récupérer le contenu. Veuillez réessayer.`,
        variant: "destructive",
      })
      setSelectedContent(null)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchBrowseContent = (page: number) => {
    fetchBrowseContentInfinite(page)
  }

  const getRandomContent = () => {
    getRandomContentInfinite()
  }

  const searchContent = async () => {
    if (searchQuery.trim().length < 2) return

    setIsSearching(true)
    try {
      const response = await fetch(`/api/content?search=${encodeURIComponent(searchQuery)}&type=${contentType}`)
      const data = await response.json()

      if (data.success) {
        setSearchResults(data.results)
        setCurrentMode("search")
      }
    } catch (error) {
      console.error("Erreur recherche:", error)
      toast({
        title: "Erreur de recherche",
        description: "Impossible de rechercher le contenu.",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  const openNetflix = (content: ContentItem) => {
    setWatchHistory((prev) => {
      const filtered = prev.filter((item) => item.id !== content.id)
      return [content, ...filtered].slice(0, 50)
    })

    const netflixUrl = `https://www.netflix.com/search?q=${encodeURIComponent(content.title)}`
    window.open(netflixUrl, "_blank")
  }

  // Fonction pour marquer un contenu comme vu
  const toggleWatched = (content: ContentItem) => {
    const isWatched = watchedContent.some((watched) => watched.id === content.id)

    if (isWatched) {
      setWatchedContent(watchedContent.filter((watched) => watched.id !== content.id))
      toast({
        title: "Retiré des vus",
        description: `${content.title} a été retiré de vos contenus vus.`,
      })
    } else {
      setWatchedContent((prev) => [...prev, content])
      toast({
        title: "Marqué comme vu",
        description: `${content.title} a été marqué comme vu.`,
      })
    }
  }

  // 2. Ajouter une fonction pour rechercher des films par acteur
  // Modifier la fonction searchByActor pour indiquer que nous venons d'une recherche par acteur
  const searchByActor = async (actor: CastMember) => {
    setIsLoading(true)
    setIsActorSearch(true)
    try {
      // Stocker l'image de l'acteur si disponible
      setSearchedActorImage(actor.profile_path)

      const response = await fetch(`/api/content?actor=${encodeURIComponent(actor.name)}&type=${contentType}`)
      const data = await response.json()

      if (data.success && data.results && data.results.length > 0) {
        setBrowseContent(data.results)
        setCurrentPage("browse")

        // Utiliser le nom de l'acteur renvoyé par l'API ou celui fourni
        const actorName = data.actorName || actor.name
        setSearchedActorName(actorName)

        // Afficher un toast pour informer l'utilisateur
        toast({
          title: `Films avec ${actorName}`,
          description: `${data.results.length} résultats trouvés`,
        })

        // Faire défiler vers le haut de la page
        if (browseContainerRef.current) {
          browseContainerRef.current.scrollTop = 0
        }
      } else {
        toast({
          title: "Aucun résultat",
          description: `Aucun contenu trouvé avec ${actor.name}`,
          variant: "destructive",
        })
        setIsActorSearch(false)
        setSearchedActorImage(null)
      }
    } catch (error) {
      console.error("Erreur lors de la recherche par acteur:", error)
      toast({
        title: "Erreur de recherche",
        description: "Impossible de rechercher des films pour cet acteur.",
        variant: "destructive",
      })
      setIsActorSearch(false)
      setSearchedActorImage(null)
    } finally {
      setIsLoading(false)
    }
  }

  // 2. Améliorer la fonction toggleFavorite pour qu'elle fonctionne correctement dans Explorer
  const toggleFavorite = (content: ContentItem) => {
    const isFavorite = favorites.some((fav) => fav.id === content.id)

    if (isFavorite) {
      setFavorites(favorites.filter((fav) => fav.id !== content.id))
      toast({
        title: "Retiré des favoris",
        description: `${content.title} a été retiré de vos favoris.`,
      })
    } else {
      setFavorites((prev) => [...prev, content]) // Utiliser le callback pour éviter les problèmes de mise à jour
      toast({
        title: "Ajouté aux favoris",
        description: `${content.title} a été ajouté à vos favoris.`,
      })
    }
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const toggleTrailerPlayback = () => {
    const newPlayingState = !isTrailerPlaying
    setIsTrailerPlaying(newPlayingState)

    if (trailerRef.current && selectedContent?.trailer) {
      try {
        const currentSrc = trailerRef.current.src
        if (currentSrc && currentSrc !== "about:blank") {
          const url = new URL(currentSrc)
          url.searchParams.set("autoplay", newPlayingState ? "1" : "0")
          trailerRef.current.src = url.toString()
        }
      } catch (error) {
        console.error("Erreur lors du contrôle de la vidéo:", error)
      }
    }
  }

  const toggleMute = () => {
    const newMutedState = !isMuted
    setIsMuted(newMutedState)

    if (trailerRef.current && selectedContent?.trailer) {
      try {
        const currentSrc = trailerRef.current.src
        if (currentSrc && currentSrc !== "about:blank") {
          const url = new URL(currentSrc)
          url.searchParams.set("mute", newMutedState ? "1" : "0")
          trailerRef.current.src = url.toString()
        }
      } catch (error) {
        console.error("Erreur lors du contrôle du son:", error)
      }
    }
  }

  const truncateDescription = (text: string, maxLength = 200) => {
    if (!text) {
      // Créer un texte de remplissage pour atteindre 4 lignes
      return "Description non disponible. Ce contenu n'a pas encore de description détaillée. Découvrez-le en le regardant sur Netflix."
    }

    // Calculer la longueur nécessaire pour 4 lignes (environ 160-200 caractères)
    const targetLength = 180

    if (text.length < targetLength) {
      // Ajouter du texte de remplissage pour atteindre 4 lignes
      const padding = " Découvrez ce contenu passionnant sur Netflix et plongez dans une expérience unique."
      let paddedText = text
      while (paddedText.length < targetLength) {
        paddedText += padding
      }
      return paddedText.substring(0, targetLength).trim() + "..."
    }

    if (text.length <= maxLength) return text
    return text.substring(0, maxLength).trim() + "..."
  }

  // 1. Modifier la fonction selectContent pour rediriger vers l'accueil au lieu de la page détails
  const selectContent = async (content: ContentItem) => {
    await selectContentWithPreload(content)
    setCurrentPage("home") // Changer "details" en "home" pour rediriger vers l'accueil
    setIsTrailerLoaded(false)
  }

  // Fonction pour réinitialiser les contenus vus
  const resetSeenContent = () => {
    setSeenContentIds(new Set())
    setUsedContentPool([])
    toast({
      title: "Historique réinitialisé",
      description: "Vous pouvez maintenant retomber sur des films déjà vus.",
    })
  }

  // 3. Forcer la qualité 1080p pour la bande-annonce
  // Modifier la partie où l'URL de la bande-annonce est définie dans useEffect
  useEffect(() => {
    if (selectedContent?.trailer && trailerRef.current && contentReady) {
      trailerRef.current.src = "about:blank"

      setTimeout(() => {
        if (trailerRef.current && selectedContent?.trailer) {
          const trailerUrl = `https://www.youtube.com/embed/${selectedContent.trailer}?autoplay=${
            isTrailerPlaying ? "1" : "0"
          }&mute=${isMuted ? "1" : "0"}&loop=1&playlist=${
            selectedContent.trailer
          }&controls=0&showinfo=0&rel=0&hl=fr&cc_lang_pref=fr&cc_load_policy=1&enablejsapi=1&origin=${encodeURIComponent(
            window.location.origin,
          )}&vq=hd1080&hd=1&modestbranding=1`
          trailerRef.current.src = trailerUrl

          const handleLoad = () => {
            setIsTrailerLoaded(true)
          }

          trailerRef.current.addEventListener("load", handleLoad)

          return () => {
            if (trailerRef.current) {
              trailerRef.current.removeEventListener("load", handleLoad)
            }
          }
        }
      }, 300)
    }
  }, [selectedContent?.trailer, isMuted, isTrailerPlaying, contentReady])

  // Effet pour la recherche
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchContent()
      } else if (searchQuery.trim().length === 0) {
        setSearchResults([])
        setCurrentMode("roulette")
      }
    }, 500)

    return () => clearTimeout(delaySearch)
  }, [searchQuery, contentType])

  // Modifier l'effet qui recharge le contenu browse pour ne pas recharger si nous venons d'une recherche par acteur
  useEffect(() => {
    if (currentPage === "browse" && !isActorSearch) {
      fetchBrowseContent(1)
    }

    // Réinitialiser isActorSearch quand les filtres changent manuellement
    if (isActorSearch && (category !== "all" || yearFilter !== "all" || ratingFilter !== "all" || actorFilter !== "")) {
      setIsActorSearch(false)
    }
  }, [contentType, category, yearFilter, ratingFilter, actorFilter, currentPage, isActorSearch])

  // Ajouter un effet pour réinitialiser isActorSearch quand on quitte la page browse
  useEffect(() => {
    if (currentPage !== "browse") {
      setIsActorSearch(false)
    }
  }, [currentPage])

  // Recharger le contenu quand le type change et réinitialiser les pools
  useEffect(() => {
    setUsedContentPool([])
    setCurrentContentPool([])
    setAvailableContent([])
    setSelectedContent(null)
    setContentReady(false)

    if (currentPage === "browse") {
      fetchBrowseContent(1)
    }
    fetchContent()
    fetchNewReleases()
    fetchContentStats()
  }, [contentType])

  // Recharger quand les filtres changent
  useEffect(() => {
    setUsedContentPool([])
    setCurrentContentPool([])
    setAvailableContent([])
    setContentReady(false)
    fetchContent()
  }, [category, yearFilter, ratingFilter, actorFilter])

  // Rendu conditionnel des favoris
  const renderFavorites = () => (
    <div className="h-full overflow-y-auto p-4 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl lg:text-4xl font-black text-white mb-2">Mes Favoris</h2>
          <p className="text-gray-300 text-lg">
            Vos {contentType === "movie" ? "films" : "séries"} préférés ({favorites.length})
          </p>
        </div>
        <div className="flex gap-4">
          <Button
            onClick={resetSeenContent}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-full px-6 py-3"
          >
            <Shuffle className="h-5 w-5 mr-2" />
            Réinitialiser l'historique
          </Button>
          <Button
            onClick={() => {
              setCurrentMode("roulette")
              setCurrentPage("home")
            }}
            className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-full px-6 py-3"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Retour à l'accueil
          </Button>
        </div>
      </div>

      {favorites.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 lg:gap-6">
          {favorites.map((item) => (
            <motion.div
              key={item.id}
              className="cursor-pointer group"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                selectContentWithPreload(item)
                setCurrentPage("home")
                setCurrentMode("roulette")
              }}
            >
              <div className="relative h-64 lg:h-80 rounded-2xl overflow-hidden shadow-xl">
                <Image
                  src={item.image || "/placeholder.svg"}
                  alt={item.title}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
                  loading="lazy"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-80"></div>

                <div className="absolute top-3 left-3">
                  <Badge className="bg-pink-600 text-red-600 border-none text-xs">FAVORI</Badge>
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-white text-sm lg:text-lg font-bold mb-2 line-clamp-2">{item.title}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="h-3 w-3 lg:h-4 lg:w-4 text-yellow-400" />
                      <span className="text-xs lg:text-sm text-gray-200">{item.rating}/10</span>
                    </div>
                    <span className="text-xs lg:text-sm text-white-300">{item.year}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Heart className="h-16 w-16 mx-auto text-gray-600 mb-6" />
          <h3 className="text-2xl font-bold text-white mb-4">Aucun favori</h3>
          <p className="text-gray-400 text-lg">Ajoutez des contenus à vos favoris pour les retrouver ici</p>
        </div>
      )}
    </div>
  )

  const renderWatched = () => (
    <div className="h-full overflow-y-auto p-4 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl lg:text-4xl font-black text-white mb-2">Déjà Regardé</h2>
          <p className="text-gray-300 text-lg">
            Vos {contentType === "movie" ? "films" : "séries"} déjà vus ({watchedContent.length})
          </p>
        </div>
        <div className="flex gap-4">
          <Button
            onClick={resetSeenContent}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-full px-6 py-3"
          >
            <Shuffle className="h-5 w-5 mr-2" />
            Réinitialiser l'historique
          </Button>
          <Button
            onClick={() => {
              setCurrentMode("roulette")
              setCurrentPage("home")
            }}
            className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-full px-6 py-3"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Retour à l'accueil
          </Button>
        </div>
      </div>

      {watchedContent.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 lg:gap-6">
          {watchedContent.map((item) => (
            <motion.div
              key={item.id}
              className="cursor-pointer group"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                selectContentWithPreload(item)
                setCurrentPage("home")
                setCurrentMode("roulette")
              }}
            >
              <div className="relative h-64 lg:h-80 rounded-2xl overflow-hidden shadow-xl">
                <Image
                  src={item.image || "/placeholder.svg"}
                  alt={item.title}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
                  loading="lazy"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-80"></div>

                <div className="absolute top-3 left-3">
                  <Badge className="bg-blue-800 text-white border-none text-xs">VU</Badge>
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-white text-sm lg:text-lg font-bold mb-2 line-clamp-2">{item.title}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="h-3 w-3 lg:h-4 lg:w-4 text-yellow-400" />
                      <span className="text-xs lg:text-sm text-gray-200">{item.rating}/10</span>
                    </div>
                    <span className="text-xs lg:text-sm text-gray-300">{item.year}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Eye className="h-16 w-16 mx-auto text-gray-600 mb-6" />
          <h3 className="text-2xl font-bold text-white mb-4">Aucun contenu vu</h3>
          <p className="text-gray-400 text-lg">Marquez des contenus comme vus pour les retrouver ici</p>
        </div>
      )}
    </div>
  )

  return (
    <div
      ref={containerRef}
      className="h-screen w-screen flex flex-col bg-gradient-to-br from-red-600/30 via-black to-black overflow-hidden fixed inset-0"
      onClick={handleBackgroundClick}
    >
      {currentMode === "favorites" ? (
        renderFavorites()
      ) : currentMode === "watched" ? (
        renderWatched()
      ) : (
        <>
          {/* Header ultra-moderne - Nouvelle navbar compacte */}
          <AnimatePresence>
            {true && (
              <motion.div
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -100 }}
                transition={{ duration: 0.3 }}
                className="flex-shrink-0 p-2 bg-black/100 backdrop-blur-xl border-b border-red-500 z-20 relative"

              >
                <div className="flex items-center justify-between gap-3">
                  {/* Logo et titre */}
                  <div className="flex items-center gap-5">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                      className="lg:hidden text-white hover:bg-white/10"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>

                    <div className="flex items-center gap-0">
                      <NetflixLogo />
                      <div className="flex items-center bg-transparent text-red-600 py-2 rounded-lg">
      <Shuffle className="w-6 h-6" />
    </div>
                    </div>

                    <Tabs
                      value={contentType}
                      className="w-auto"
                      onValueChange={(value) => {
                        setContentType(value as "movie" | "tv")
                      }}
                    >
                      <TabsList className="bg-black/100  h-8">
                        <TabsTrigger
                          value="movie"
                          className="data-[state=active]:bg-red-600 text-white uppercase data-[state=active]:text-white text-xs px-5 py-3"
                        >
                          <Film className="mr-1 h-3 w-3" />
                          Films
                        </TabsTrigger>
                        <TabsTrigger
                          value="tv"
                          className="data-[state=active]:bg-red-600 text-white uppercase data-[state=active]:text-white text-xs px-5 py-3"
                        >
                          <Tv className="mr-1 h-3 w-3" />
                          Séries
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    {/* Navigation des pages */}
                    <div className="hidden lg:flex gap-1">
                      <Button
                        variant={currentPage === "home" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setCurrentPage("home")}
                        className="data-[state=active]:bg-red-600 text-white uppercase data-[state=active]:text-white text-xs px-5 py-3"
                      >
                        <Home className="h-4 w-4" />
                        ACCUEIL
                      </Button>
                      <Button
                        variant={currentPage === "browse" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setCurrentPage("browse")}
                        className="data-[state=active]:bg-red-600 text-white uppercase data-[state=active]:text-white text-xs px-5 py-3"
                      >
                        <Compass className="h-4 w-4" />
                        EXPLORER
                      </Button>
                    </div>
                  </div>

                  {/* Contrôles de droite */}
                  <div className="flex items-center gap-2">
                    

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentMode("favorites")}
                      className={`${
                        currentMode === "favorites"
                          ? "bg-gradient-to-r from-pink-500 to-red-500 text-white"
                          : "text-white hover:bg-white/10"
                      } backdrop-blur-md border border-white/20 rounded-full px-3 py-1 h-8 text-xs`}
                    >
                      <Heart
                        className={`h-3 w-3 mr-1 ${currentMode === "favorites" || favorites.length > 0 ? "fill-current" : ""}`}
                      />
                      {favorites.length}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentMode("watched")}
                      className={`${
                        currentMode === "watched"
                          ? "bg-gradient-to-r from-blue-800 to-cyan-500 text-white"
                          : "text-white hover:bg-white/10"
                      } backdrop-blur-md border border-white/20 rounded-full px-3 py-1 h-8 text-xs`}
                    >
                      <Eye
                        className={`h-3 w-3 mr-1 ${currentMode === "watched" || watchedContent.length > 0 ? "fill-current" : ""}`}
                      />
                      {watchedContent.length}
                    </Button>

                    <Select
                      value={category}
                      onValueChange={(value) => {
                        setCategory(value)
                      }}
                    >
                      <SelectTrigger className="w-32 h-8 bg-white/10 backdrop-blur-md border border-white/20 text-white focus:ring-red-500 rounded-full text-xs">
                        <SelectValue placeholder="Genre" />
                      </SelectTrigger>
                      <SelectContent className="bg-black/90 backdrop-blur-xl border border-white/20">
                        {(contentType === "movie" ? filmCategories : seriesCategories).map((cat) => (
                          <SelectItem key={cat.id} value={cat.id} className="text-white hover:bg-white/10">
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      className="text-white hover:bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-3 py-1 h-8 text-xs"
                    >
                      <Filter className="h-3 w-3 mr-1" />
                      Filtres
                    </Button>

                    {contentStats.movies > 0 && (
                      <div className="hidden xl:flex items-center gap-2 bg-white/5 backdrop-blur-xl rounded-full px-3 py-1 border border-white/10 h-8">
                        <BarChart3 className="h-3 w-3 text-blue-800" />
                        <div className="flex items-center gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <Film className="h-3 w-3 text-red-400" />
                            <span className="text-white font-bold">{contentStats.movies.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Tv className="h-3 w-3 text-blue-800" />
                            <span className="text-white font-bold">{contentStats.series.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Filtres avancés */}
                {showAdvancedFilters && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="mt-3 p-4 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="text-xs font-medium text-gray-300 mb-1 block">Année</label>
                        <Select value={yearFilter} onValueChange={setYearFilter}>
                          <SelectTrigger className="h-8 bg-white/10 backdrop-blur-md border border-white/20 text-white focus:ring-red-500 rounded-xl text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-black/90 backdrop-blur-xl border border-white/20 max-h-60">
                            {yearOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                                className="text-white hover:bg-white/10"
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-300 mb-1 block">Note minimale</label>
                        <Select value={ratingFilter} onValueChange={setRatingFilter}>
                          <SelectTrigger className="h-8 bg-white/10 backdrop-blur-md border border-white/20 text-white focus:ring-red-500 rounded-xl text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-black/90 backdrop-blur-xl border border-white/20">
                            {ratingOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                                className="text-white hover:bg-white/10"
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-300 mb-1 block">Acteur</label>
                        <div className="relative">
                          <Input
                            type="text"
                            placeholder="Nom de l'acteur..."
                            value={actorFilter}
                            onChange={(e) => setActorFilter(e.target.value)}
                            className="pl-7 pr-3 py-1 h-8 bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-gray-300 focus:border-red-500 focus:ring-red-500 rounded-xl text-xs"
                          />
                          <User className="absolute left-2 top-2 h-3 w-3 text-gray-400" />
                        </div>
                      </div>

                      <div className="flex items-end">
                        <Button
                          onClick={() => {
                            setShowAdvancedFilters(false)
                          }}
                          className="w-full h-8 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-xl text-xs"
                        >
                          Appliquer
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Casting Section - Bottom Right - Seulement sur la page d'accueil */}
          {currentPage === "home" &&
            selectedContent &&
            contentReady &&
            selectedContent.cast &&
            Array.isArray(selectedContent.cast) &&
            selectedContent.cast.length > 0 && (
              <AnimatePresence>
                {!isUIHidden && (
                  <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    className="absolute bottom-4 right-4 z-30 max-w-md"
                  >
                    <h3 className="text-white text-lg font-semibold mb-3 drop-shadow-lg">Casting</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {selectedContent.cast.slice(0, 5).map((actor, index) => (
                        <motion.div
                          key={actor.id}
                          className="flex-shrink-0 text-center cursor-pointer hover:scale-105 transition-transform"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.4, delay: 0.7 + index * 0.1 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            searchByActor(actor)
                          }}
                        >
                          <div className="w-16 h-26 rounded-lg overflow-hidden mb-2 bg-gray-800 relative group shadow-lg">
                            {actor.profile_path ? (
                              <Image
                                src={actor.profile_path || "/placeholder.svg"}
                                alt={actor.name}
                                width={64}
                                height={128}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <User className="h-8 w-8 text-gray-400" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Search className="h-5 w-5 text-red" />
                            </div>
                          </div>
                          <p className="text-white uppercase text-xs font-medium max-w-[64px] line-clamp-2 drop-shadow-md">
                            {actor.name}
                          </p>
                          <p className="text-gray-400 text-xs max-w-[64px] line-clamp-1 drop-shadow-md">
                            {actor.character}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

          {/* Contenu principal */}
          <div className="flex-1 relative overflow-hidden">
            {/* Page d'accueil */}
            {currentPage === "home" && (
              <div className="h-full w-full overflow-hidden">
                {/* Arrière-plan : Bande-annonce OU image backdrop */}
                {selectedContent && (
                  <div className="absolute inset-0 z-0">
                    {selectedContent.trailer ? (
                      <>
                        <iframe
                          ref={trailerRef}
                          width="100%"
                          height="100%"
                          title="Bande-annonce"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                          allowFullScreen
                          className="absolute inset-0 w-full h-full"
                          style={{
                            width: "100vw",
                            height: "100vh",
                            position: "fixed",
                            top: 10,
                            left: 0,
                            zIndex: -1,
                            backgroundColor: "black",
                            transform: "scale(1.5)",
                          }}
                        ></iframe>
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/0 to-black/0"></div>

                        {/* Contrôles de bande-annonce */}
                        <AnimatePresence>
                          {!isUIHidden && (
                            <motion.div
                              initial={{ opacity: 1 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="absolute bottom-6 right-6 z-50"
                            >
                              <div className="bg-black/40 backdrop-blur-xl rounded-full p-2 border border-white/10">
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={toggleMute}
                                    className="text-white hover:bg-white/20 rounded-full p-2 h-10 w-10"
                                    title={isMuted ? "Activer le son" : "Couper le son"}
                                  >
                                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={toggleTrailerPlayback}
                                    className="text-white hover:bg-white/20 rounded-full p-2 h-10 w-10"
                                    title={isTrailerPlaying ? "Pause" : "Lecture"}
                                  >
                                    {isTrailerPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={toggleFullscreen}
                                    className="text-white hover:bg-white/20 rounded-full p-2 h-10 w-10"
                                    title="Plein écran"
                                  >
                                    <Maximize className="h-5 w-5" />
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    ) : selectedContent.backdrop ? (
                      <>
                        <Image
                          src={selectedContent.backdrop || "/placeholder.svg"}
                          alt={selectedContent.title}
                          fill
                          className="object-cover"
                          priority
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/60"></div>
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-800"></div>
                    )}
                  </div>
                )}

                <div className="relative z-10 h-full flex flex-col">
                  {/* Contenu sélectionné */}
                  <AnimatePresence mode="wait">
                    {selectedContent && contentReady ? (
                      <AnimatePresence>
                        {!isUIHidden && (
                          <div className="absolute inset-x-0 bottom-0 z-10 h-full flex flex-col justify-end">
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent pointer-events-none"></div>

                            <motion.div
                              key={selectedContent.id}
                              initial={{ opacity: 0, y: 15 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -30 }}
                              transition={{ duration: 0.8, ease: "easeInOut" }}
                              className="absolute left-4 bottom-4"
                            >
                              <div className="flex gap-3 ml-1">
                                {/* Affiche à gauche */}
                                <div className="flex-shrink-0">
                                  <div className="relative w-64 h-96 rounded-2xl overflow-hidden shadow-2xl mb-4 group">
                                    <Image
                                      src={selectedContent.image || "/placeholder.svg"}
                                      alt={selectedContent.title}
                                      fill
                                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                                      priority
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent"></div>
                                  </div>

                                  {/* Bouton Nouveau choix */}
                                  <Button
  onClick={getRandomContent}
  disabled={isLoading}
  className="
    w-64 h-12
    bg-red-600
    hover:from-black hover:to-red-600
    text-white font-bold text-base uppercase
    rounded-lg
    transition-all duration-300
    hover:scale-90
    disabled:opacity-100
    border border-white
    hover:border-white-500
    hover:red-600
    flex items-center justify-center
    relative overflow-hidden
    group
  "
>
  {isLoading ? (
    <>
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Chargement...
    </>
  ) : (
    <>
      Nouveau choix
    </>
  )}
</Button>


                                </div>

                                {/* Informations à droite de l'affiche */}
                                <div className="flex flex-col justify-end space-y-4 max-w-4xl">
                                  {/* Titre */}
                                  <motion.h1
                                  z-index={-100}
                                    initial={{ opacity: 0, y: 0, x:50 }}
                                    animate={{ opacity: 1, y: 0, x:0 }}
                                    transition={{ duration: 0.6, delay: 0.2 }}
                                    className="text-[60px] font-black text-white leading-[65px] uppercase"
                                    style={{
                                      textShadow: "2px 2px 4px rgba(0, 0, 0, 0.8)",
                                      fontWeight: 900,
                                    }}
                                    
                                  >
                                    {selectedContent.title}
                                  </motion.h1>
                                  <div className="h-0.5 mt-0.5 w-100 bg-gradient-to-r from-red-500 to-transparent"></div>

                                  
                                  {/* Description complète */}
                                  <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.5 }}
                                    className="max-w-5xl"
                                  >
                                    <p className="text-gray-400 text-base xs:text-lg leading-relaxed font-medium">
                                      {selectedContent.description || "Description non disponible pour ce contenu."}
                                    </p>
                                  </motion.div>

                                  {/* Métadonnées en ligne avec tags */}
                                  <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.3 }}
                                    className="flex flex-wrap items-center gap-3 text-base"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                                      <span className="text-white font-bold">{selectedContent.rating}/10</span>
                                    </div>
                                    <span className="text-gray-300 font-medium">{selectedContent.year}</span>
                                    {selectedContent.duration && (
                                      <span className="text-gray-300 font-medium">{selectedContent.duration}</span>
                                    )}
                                    {selectedContent.seasons && (
                                      <span className="text-gray-300 font-medium">{selectedContent.seasons}</span>
                                    )}

                                    {/* Tags à côté des métadonnées */}
                                    {selectedContent.categories.slice(0, 3).map((cat, index) => (
                                      //*BADGES CATEGORIES */
                                      <Badge
                                        key={index}
                                        className="bg-red-600 text-white uppercase border-none px-4 py-1 text-xs font-bold backdrop-blur-sm"
                                      >
                                        {cat}
                                      </Badge>
                                    ))}
                                  </motion.div>

                                  {/* Boutons d'action */}
                                  <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.4 }}
                                    className="flex flex-wrap gap-3"
                                  >
                                    <Button
                                      onClick={() => openNetflix(selectedContent)}
                                      className="border border-white text-white bg-transparent font-bold px-6 py-2 rounded-xl text-base h-12 transition duration-300 hover:bg-white hover:text-black"


                                    >
                                      <Play className="mr-2 h-4 w-4 fill-current" />
                                      Regarder
                                    </Button>

                                    <Button
                                      onClick={() => toggleFavorite(selectedContent)}
                                      className={`px-6 py-3 rounded-xl text-base h-12 transition-all duration-300 hover:scale-105 font-bold ${
                                        favorites.some((fav) => fav.id === selectedContent.id)
                                          ? "bg-red-600 hover:bg-red-700 text-white border-2 border-red-500"
                                          : "bg-black/60 hover:bg-black/80 text-white border-2 border-white/30 backdrop-blur-sm"
                                      }`}
                                    >
                                      <Heart
                                        className={`mr-2 h-4 w-4 ${favorites.some((fav) => fav.id === selectedContent.id) ? "fill-current" : ""}`}
                                      />
                                      {favorites.some((fav) => fav.id === selectedContent.id) ? "J'aime" : "J'aime"}
                                    </Button>

                                    <Button
                                      onClick={() => toggleWatched(selectedContent)}
                                      className={`px-6 py-3 rounded-xl text-base h-12 transition-all duration-300 hover:scale-105 font-bold ${
                                        watchedContent.some((watched) => watched.id === selectedContent.id)
                                          ? "bg-blue-800 hover:bg-blue-800 text-blue-300 border-2 border-blue-800"
                                          : "bg-black/60 hover:bg-black/80 text-white border-2 border-white/30 backdrop-blur-sm"
                                      }`}
                                    >
                                      <Eye
                                        className={`mr-2 h-4 w-4 ${watchedContent.some((watched) => watched.id === selectedContent.id) ? "" : ""}`}
                                      />
                                      {watchedContent.some((watched) => watched.id === selectedContent.id)
                                        ? "Déjà vu"
                                        : "Déjà vu"}
                                    </Button>
                                  </motion.div>

                                  
                                </div>
                              </div>
                            </motion.div>
                          </div>
                        )}
                      </AnimatePresence>
                    ) : selectedContent && !contentReady ? (
                      <AnimatePresence>
                        {!isUIHidden && (
                          <div className="absolute inset-x-0 bottom-0 z-10 h-full flex flex-col justify-end">
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent pointer-events-none"></div>

                            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-20">
                              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                                <div className="flex items-center gap-3">
                                  <Loader2 className="h-6 w-6 text-red-500 animate-spin" />
                                  <span className="text-white font-medium">Chargement du nouveau contenu...</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </AnimatePresence>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center justify-center h-full"
                      >
                      
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Page Explorer - Mode grille simplifié */}
            {currentPage === "browse" && (
              <div className="h-full overflow-y-auto" ref={browseContainerRef}>
                <div className="p-4 lg:p-8">
                  <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                    <div>
                      {isActorSearch ? (
                        <div className="flex items-center gap-4 mb-4">
                          {searchedActorImage && (
                            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-red-500 flex-shrink-0">
                              <Image
                                src={searchedActorImage || "/placeholder.svg"}
                                alt={searchedActorName || "Acteur"}
                                width={64}
                                height={64}
                                className="object-cover w-full h-full"
                              />
                            </div>
                          )}
                          <div>
                            <h2 className="text-3xl lg:text-4xl font-black text-white mb-2">
                              Films avec {searchedActorName || "cet acteur"}
                            </h2>
                            <p className="text-white text-lg">
                              {browseContent.length} résultats trouvés sur Netflix France
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h2 className="text-3xl lg:text-4xl font-black text-white mb-2 uppercase">
                            Explorer les {contentType === "movie" ? "Films" : "Séries"} Netflix disponible en France
                          </h2>
                          <div className="h-0.5 mt-2 w-150 bg-gradient-to-r from-red-500 to-transparent"></div>
                        </>
                      )}
                    </div>
                  </div>

                  {browseContent.length > 0 ? (
                    <>
                      <div className="grid grid-cols-12 gap-2 auto-rows-[200px]">
                        {browseContent.map((item, index) => {
                          // Déterminer si le film mérite un style spécial (note > 7)
                          const isHighRated = item.rating > 8

                          // Pattern de bento optimisé sans trous
                          let colSpan = 2 // Taille par défaut
                          let rowSpan = 1

                          // Pattern répétitif tous les 15 éléments pour éviter les trous
                          const patternIndex = index % 15

                          switch (patternIndex) {
                            case 0: // Grande carte horizontale
                              colSpan = 6
                              rowSpan = 2
                              break
                            case 1: // Carte verticale
                              colSpan = 3
                              rowSpan = 2
                              break
                            case 2: // Carte verticale
                              colSpan = 3
                              rowSpan = 2
                              break
                            case 3: // Carte normale
                              colSpan = 2
                              rowSpan = 1
                              break
                            case 4: // Carte normale
                              colSpan = 2
                              rowSpan = 1
                              break
                            case 5: // Carte normale
                              colSpan = 2
                              rowSpan = 1
                              break
                            case 6: // Carte large
                              colSpan = 4
                              rowSpan = 1
                              break
                            case 7: // Carte normale
                              colSpan = 2
                              rowSpan = 1
                              break
                            case 8: // Carte normale
                              colSpan = 2
                              rowSpan = 1
                              break
                            case 9: // Carte normale
                              colSpan = 2
                              rowSpan = 1
                              break
                            case 10: // Carte verticale
                              colSpan = 3
                              rowSpan = 2
                              break
                            case 11: // Carte normale
                              colSpan = 3
                              rowSpan = 1
                              break
                            case 12: // Carte normale
                              colSpan = 2
                              rowSpan = 1
                              break
                            case 13: // Carte normale
                              colSpan = 2
                              rowSpan = 1
                              break
                            case 14: // Carte normale
                              colSpan = 2
                              rowSpan = 1
                              break
                            default:
                              colSpan = 2
                              rowSpan = 1
                          }

                          const isLarge = colSpan >= 4 || rowSpan >= 2

                          return (
                            <motion.div
                              key={item.id}
                              className="cursor-pointer group relative"
                              style={{ gridColumn: `span ${colSpan}`, gridRow: `span ${rowSpan}` }}
                              initial={{ opacity: 0, scale: 1 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.02, delay: index * 0.02 }}
                              whileHover={{ scale: 1 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => selectContent(item)}
                            >
                              <div
                                className={`relative h-full rounded-2xl overflow-hidden transition-all duration-9000 ${
                                  isHighRated
                                }`}
                              >
                                <Image
                                  src={isLarge ? item.backdrop || item.image : item.image || "/placeholder.svg"}
                                  alt={item.title}
                                  fill
                                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                                />

                                <div
                                  className={`absolute inset-0 ${
                                    isHighRated
                                      ? "bg-gradient-to-t from-yellow-700/90 via-yellow-900/40 to-transparent"
                                      : "bg-gradient-to-t from-black/80 via-red-900/30 to-transparent"
                                  }`}
                                ></div>

                                {/* Boutons d'action */}
                                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleFavorite(item)
                                      }}
                                      className={`h-12 w-12 p-0 rounded-full backdrop-blur-sm ${
                                        favorites.some((fav) => fav.id === item.id)
                                          ? "bg-red-600 text-white"
                                          : "bg-black/60 text-white hover:bg-red-600"
                                      } transition-all duration-200`}
                                    >
                                      <Heart className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleWatched(item)
                                      }}
                                      className={`h-12 w-12 p-0 rounded-full backdrop-blur-sm ${
                                        watchedContent.some((watched) => watched.id === item.id)
                                          ? "bg-blue-600 text-white"
                                          : "bg-black/60 text-white hover:bg-blue-600"
                                      } transition-all duration-200`}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>

                                {/* Note en haut à gauche */}
                                <div className="absolute top-3 left-3">
                                  <div
                                    className={`flex items-center gap-1 backdrop-blur-sm rounded-full px-2 py-1 ${
                                      isHighRated ? "bg-black" : "bg-black"
                                    }`}
                                  >
                                    <Star className="h-30 w-30 text-yellow-500 fill-current" />
                                    <span className="text-white text-xs font-bold">{item.rating}</span>
                                  </div>
                                </div>

                                {/* Contenu en bas */}
                                <div className="absolute bottom-0 left-0 right-0 p-5">
                                  {isLarge ? (
                                    // Layout pour les grandes cartes
                                    <div className="flex gap-4">
                                      <div className="flex-shrink-0">
                                        <div className="relative w-16 h-24 rounded-lg overflow-hidden border border-white/20">
                                          <Image
                                            src={item.image || "/placeholder.svg"}
                                            alt={item.title}
                                            fill
                                            className="object-cover"
                                          />
                                        </div>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h3
                                          className={`text-lg font-bold transition-colors duration-200 line-clamp-2 mb-2 ${
                                            isHighRated
                                              ? "text-white group-hover:text-white-900"
                                              : "text-white group-hover:text-white-900"
                                          }`}
                                        >
                                          {item.title}
                                        </h3>
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="text-white text-sm">{item.year}</span>
                                          {item.duration && (
                                            <span className="text-white text-sm">{item.duration}</span>
                                          )}
                                          {item.seasons && (
                                            <span className="text-white text-sm">{item.seasons}</span>
                                          )}
                                        </div>
                                        <p className="text-white text-sm leading-relaxed line-clamp-2">
                                          {truncateDescription(item.description, 100)}
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    // Layout pour les cartes normales
                                    <div>
                                      <h3
                                        className={`font-bold mb-2 line-clamp-2 text-sm transition-colors duration-200 ${
                                          isHighRated
                                            ? "text-white group-hover:text-white-900"
                                            : "text-white group-hover:text-white-900"
                                        }`}
                                      >
                                        {item.title}
                                      </h3>
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-white">{item.year}</span>
                                        {item.duration && <span className="text-white">{item.duration}</span>}
                                        {item.seasons && <span className="text-white">{item.seasons}</span>}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>

                      {isLoadingMore && (
                        <div className="flex justify-center py-8">
                          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20">
                            <div className="flex items-center gap-3">
                              <Loader2 className="h-5 w-5 text-red-500 animate-spin" />
                              <span className="text-white">Chargement de plus de contenu...</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-16">
                      <Search className="h-16 w-16 mx-auto text-gray-600 mb-6" />
                      <h3 className="text-2xl font-bold text-white mb-4">Aucun contenu trouvé</h3>
                      <p className="text-gray-400 text-lg">Essayez avec d'autres filtres ou critères de recherche</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
