import { type NextRequest, NextResponse } from "next/server"

const TMDB_API_KEY = "5f5c1d67955c4034ebfc09cbf0288df6"
const TMDB_BASE_URL = "https://api.themoviedb.org/3"
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"

// Mapping des genres TMDb vers nos catégories
const GENRE_MAPPING: { [key: number]: string } = {
  28: "action",
  12: "adventure",
  16: "animation",
  35: "comedy",
  80: "crime",
  99: "documentary",
  18: "drama",
  10751: "family",
  14: "fantasy",
  36: "history",
  27: "horror",
  10402: "music",
  9648: "mystery",
  10749: "romance",
  878: "scifi",
  10770: "tv",
  53: "thriller",
  10752: "war",
  37: "western",
}

// Cache optimisé
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const CONTENT_CACHE: { [key: string]: { data: any[]; timestamp: number; totalPages: number; total: number } } = {}

// Fonction pour gérer les erreurs de rate limiting
async function fetchWithRetry(url: string, retries = 3, delay = 2000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url)

      // Gérer spécifiquement l'erreur 429 (Too Many Requests)
      if (response.status === 429) {
        console.warn(`Rate limit atteint, attente de ${delay * (i + 1)}ms avant retry ${i + 1}/${retries}`)
        // Attendre plus longtemps à chaque tentative
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 2)))
        continue
      }

      if (!response.ok) {
        // Vérifier si la réponse est du texte et non du JSON
        const contentType = response.headers.get("content-type")
        if (contentType && !contentType.includes("application/json")) {
          const text = await response.text()
          throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`)
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return response
    } catch (error) {
      console.warn(`Tentative ${i + 1}/${retries} échouée:`, error)
      if (i === retries - 1) throw error
      // Attendre plus longtemps entre les tentatives
      await new Promise((resolve) => setTimeout(resolve, delay * (i + 2)))
    }
  }

  throw new Error("Toutes les tentatives ont échoué")
}

// Fonction pour estimer la durée d'un film basée sur le genre et l'année
function estimateMovieDuration(genres: number[], year: number): string {
  const genreDurations: { [key: number]: number } = {
    28: 115, // Action
    12: 125, // Adventure
    16: 95, // Animation
    35: 105, // Comedy
    80: 110, // Crime
    99: 95, // Documentary
    18: 120, // Drama
    10751: 110, // Family
    14: 120, // Fantasy
    36: 110, // History
    27: 95, // Horror
    10402: 105, // Music
    9648: 110, // Mystery
    10749: 110, // Romance
    878: 115, // Sci-Fi
    53: 105, // Thriller
    10752: 130, // War
  }

  let avgDuration = 110
  if (genres.length > 0) {
    const durations = genres.map((g) => genreDurations[g] || 110)
    avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
  }

  if (year >= 2010) avgDuration += 10
  if (year >= 2020) avgDuration += 5

  const variation = Math.floor(Math.random() * 31) - 15
  const finalDuration = Math.max(80, avgDuration + variation)

  const hours = Math.floor(finalDuration / 60)
  const minutes = finalDuration % 60
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`
}

async function getNewReleases(type: "movie" | "tv", yearParam?: string | null, monthParam?: string | null) {
  try {
    const now = new Date()
    const year = yearParam ? Number.parseInt(yearParam) : now.getFullYear()
    const month = monthParam ? Number.parseInt(monthParam) : now.getMonth() + 1

    const startDate = `${year}-${month.toString().padStart(2, "0")}-01`
    let endDate

    if (month === 12) {
      endDate = `${year + 1}-01-01`
    } else {
      endDate = `${year}-${(month + 1).toString().padStart(2, "0")}-01`
    }

    let url = `${TMDB_BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=release_date.desc&include_adult=false`

    if (type === "movie") {
      url += `&primary_release_date.gte=${startDate}&primary_release_date.lt=${endDate}`
    } else {
      url += `&first_air_date.gte=${startDate}&first_air_date.lt=${endDate}`
    }

    url += "&with_watch_providers=8&watch_region=FR&vote_count.gte=20"

    const response = await fetchWithRetry(url)
    const data = await response.json()

    const transformedResults = data.results.slice(0, 15).map((item: any) => {
      const title = item.title || item.name
      const releaseDate = item.release_date || item.first_air_date
      const year = releaseDate ? new Date(releaseDate).getFullYear() : "Inconnu"

      const categories = item.genre_ids.map((id: number) => GENRE_MAPPING[id]).filter(Boolean)

      let seasonsDisplay = undefined
      if (type === "tv") {
        seasonsDisplay = "Série"
      }

      let durationDisplay = undefined
      if (type === "movie") {
        durationDisplay = estimateMovieDuration(item.genre_ids, year as number)
      }

      const netflixUrl = `https://www.netflix.com/search?q=${encodeURIComponent(title)}`

      return {
        id: item.id,
        title,
        description: item.overview || "Description non disponible",
        image: item.poster_path ? `${TMDB_IMAGE_BASE_URL}${item.poster_path}` : "/abstract-movie-poster.png",
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        categories,
        year,
        rating: Math.round(item.vote_average * 10) / 10,
        duration: durationDisplay,
        seasons: seasonsDisplay,
        trailer: null,
        cast: [],
        netflixUrl,
        netflixId: undefined,
      }
    })

    return NextResponse.json({
      success: true,
      results: transformedResults,
    })
  } catch (error: any) {
    console.error("Erreur lors de la récupération des nouveautés:", error)
    return NextResponse.json(
      { success: false, error: `Erreur lors de la récupération des nouveautés: ${error.message}` },
      { status: 500 },
    )
  }
}

async function getContentDetails(contentId: string, type: "movie" | "tv") {
  try {
    const detailsUrl = `${TMDB_BASE_URL}/${type}/${contentId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=credits,videos`
    const response = await fetchWithRetry(detailsUrl)
    const details = await response.json()

    const title = details.title || details.name
    const releaseDate = details.release_date || details.first_air_date
    const year = releaseDate ? new Date(releaseDate).getFullYear() : "Inconnu"

    const categories = details.genres ? details.genres.map((genre: any) => genre.name) : []

    let seasonsDisplay = undefined
    if (type === "tv") {
      const seasons = details.number_of_seasons
      if (seasons && seasons > 0) {
        seasonsDisplay = `${seasons} saison${seasons > 1 ? "s" : ""}`
      } else {
        seasonsDisplay = "Série"
      }
    }

    let durationDisplay = undefined
    if (type === "movie") {
      if (details.runtime && details.runtime > 0) {
        const hours = Math.floor(details.runtime / 60)
        const minutes = details.runtime % 60
        durationDisplay = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`
      }
    }

    const cast = details.credits?.cast
      ? details.credits.cast.slice(0, 5).map((actor: any) => ({
          id: actor.id,
          name: actor.name,
          character: actor.character,
          profile_path: actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : null,
        }))
      : []

    let trailer = null
    if (details.videos?.results?.length > 0) {
      const trailerVideo = details.videos.results.find(
        (video: any) => (video.type === "Trailer" || video.type === "Teaser") && video.site === "YouTube",
      )
      if (trailerVideo) {
        trailer = trailerVideo.key
      }
    }

    const netflixUrl = `https://www.netflix.com/search?q=${encodeURIComponent(title)}`

    const result = {
      id: details.id,
      title,
      description: details.overview || "Description non disponible",
      image: details.poster_path ? `${TMDB_IMAGE_BASE_URL}${details.poster_path}` : "/abstract-movie-poster.png",
      backdrop: details.backdrop_path ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : null,
      categories,
      year,
      rating: Math.round(details.vote_average * 10) / 10,
      duration: durationDisplay,
      seasons: seasonsDisplay,
      trailer,
      cast,
      netflixUrl,
      netflixId: undefined,
    }

    return { success: true, result }
  } catch (error: any) {
    console.error("Erreur lors de la récupération des détails:", error)
    return { success: false, error: `Erreur lors de la récupération des détails: ${error.message}` }
  }
}

async function searchContent(query: string, type: "movie" | "tv") {
  try {
    const searchUrl = `${TMDB_BASE_URL}/search/${type}?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}&include_adult=false`
    const response = await fetchWithRetry(searchUrl)
    const data = await response.json()

    const transformedResults = data.results.slice(0, 20).map((item: any) => {
      const title = item.title || item.name
      const releaseDate = item.release_date || item.first_air_date
      const year = releaseDate ? new Date(releaseDate).getFullYear() : "Inconnu"

      const categories = item.genre_ids.map((id: number) => GENRE_MAPPING[id]).filter(Boolean)

      const netflixUrl = `https://www.netflix.com/search?q=${encodeURIComponent(title)}`

      return {
        id: item.id,
        title,
        description: item.overview || "Description non disponible",
        image: item.poster_path ? `${TMDB_IMAGE_BASE_URL}${item.poster_path}` : "/abstract-movie-poster.png",
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        categories,
        year,
        rating: Math.round(item.vote_average * 10) / 10,
        duration: type === "movie" ? "Film" : "Série",
        seasons: type === "tv" ? "Série" : undefined,
        trailer: null,
        cast: [],
        netflixUrl,
        netflixId: undefined,
      }
    })

    return NextResponse.json({
      success: true,
      results: transformedResults,
    })
  } catch (error: any) {
    console.error("Erreur lors de la recherche:", error)
    return NextResponse.json(
      { success: false, error: `Erreur lors de la recherche: ${error.message}` },
      { status: 500 },
    )
  }
}

async function searchActor(query: string) {
  try {
    const searchUrl = `${TMDB_BASE_URL}/search/person?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}`
    const response = await fetchWithRetry(searchUrl)
    const data = await response.json()

    return NextResponse.json({
      success: true,
      results: data.results.slice(0, 10),
    })
  } catch (error: any) {
    console.error("Erreur lors de la recherche d'acteur:", error)
    return NextResponse.json(
      { success: false, error: `Erreur lors de la recherche d'acteur: ${error.message}` },
      { status: 500 },
    )
  }
}

// Modifier la fonction searchContentByActor pour inclure le nom de l'acteur dans la réponse
async function searchContentByActor(actorName: string, type: "movie" | "tv") {
  try {
    // D'abord, rechercher l'ID de l'acteur
    const actorSearchUrl = `${TMDB_BASE_URL}/search/person?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(actorName)}`
    const actorResponse = await fetchWithRetry(actorSearchUrl)
    const actorData = await actorResponse.json()

    if (!actorData.results || actorData.results.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Acteur non trouvé",
      })
    }

    const actor = actorData.results[0]
    const actorId = actor.id
    const actorFullName = actor.name // Récupérer le nom complet de l'acteur

    // Ensuite, rechercher les films/séries avec cet acteur
    const discoverUrl = `${TMDB_BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&language=fr-FR&with_cast=${actorId}&sort_by=popularity.desc&include_adult=false&with_watch_providers=8&watch_region=FR&vote_count.gte=20`

    const response = await fetchWithRetry(discoverUrl)
    const data = await response.json()

    const transformedResults = data.results.slice(0, 20).map((item: any) => {
      const title = item.title || item.name
      const releaseDate = item.release_date || item.first_air_date
      const year = releaseDate ? new Date(releaseDate).getFullYear() : "Inconnu"

      const categories = item.genre_ids.map((id: number) => GENRE_MAPPING[id]).filter(Boolean)

      let seasonsDisplay = undefined
      if (type === "tv") {
        seasonsDisplay = "Série"
      }

      let durationDisplay = undefined
      if (type === "movie") {
        durationDisplay = estimateMovieDuration(item.genre_ids, year as number)
      }

      const netflixUrl = `https://www.netflix.com/search?q=${encodeURIComponent(title)}`

      return {
        id: item.id,
        title,
        description: item.overview || "Description non disponible",
        image: item.poster_path ? `${TMDB_IMAGE_BASE_URL}${item.poster_path}` : "/abstract-movie-poster.png",
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        categories,
        year,
        rating: Math.round(item.vote_average * 10) / 10,
        duration: durationDisplay,
        seasons: seasonsDisplay,
        trailer: null,
        cast: [],
        netflixUrl,
        netflixId: undefined,
      }
    })

    return NextResponse.json({
      success: true,
      results: transformedResults,
      actorName: actorFullName, // Inclure le nom de l'acteur dans la réponse
    })
  } catch (error: any) {
    console.error("Erreur lors de la recherche de contenu par acteur:", error)
    return NextResponse.json(
      { success: false, error: `Erreur lors de la recherche de contenu par acteur: ${error.message}` },
      { status: 500 },
    )
  }
}

async function getComingSoon(type: "movie" | "tv") {
  try {
    const now = new Date()
    const futureDate = new Date()
    futureDate.setMonth(futureDate.getMonth() + 3)

    const startDate = now.toISOString().split("T")[0]
    const endDate = futureDate.toISOString().split("T")[0]

    let url = `${TMDB_BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=primary_release_date.asc&include_adult=false`

    if (type === "movie") {
      url += `&primary_release_date.gte=${startDate}&primary_release_date.lte=${endDate}`
    } else {
      url += `&first_air_date.gte=${startDate}&first_air_date.lte=${endDate}`
    }

    url += "&with_watch_providers=8&watch_region=FR&with_release_type=3|2&vote_count.gte=10"

    const response = await fetchWithRetry(url)
    const data = await response.json()

    const transformedResults = data.results.slice(0, 20).map((item: any) => {
      const title = item.title || item.name
      const releaseDate = item.release_date || item.first_air_date
      const year = releaseDate ? new Date(releaseDate).getFullYear() : "Inconnu"

      const categories = item.genre_ids.map((id: number) => GENRE_MAPPING[id]).filter(Boolean)

      return {
        id: item.id,
        title,
        description: item.overview || "Description non disponible",
        image: item.poster_path ? `${TMDB_IMAGE_BASE_URL}${item.poster_path}` : "/abstract-movie-poster.png",
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        categories,
        year,
        rating: Math.round(item.vote_average * 10) / 10,
        duration: type === "movie" ? "Film" : "Série",
        seasons: type === "tv" ? "Série" : undefined,
        trailer: null,
        cast: [],
        netflixUrl: `https://www.netflix.com/search?q=${encodeURIComponent(title)}`,
        netflixId: undefined,
        releaseDate: releaseDate,
      }
    })

    return NextResponse.json({
      success: true,
      results: transformedResults,
    })
  } catch (error: any) {
    console.error("Erreur lors de la récupération du contenu à venir:", error)
    return NextResponse.json(
      { success: false, error: `Erreur lors de la récupération du contenu à venir: ${error.message}` },
      { status: 500 },
    )
  }
}

async function getLeavingSoon(type: "movie" | "tv") {
  try {
    const now = new Date()
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

    const endDate = oneYearAgo.toISOString().split("T")[0]
    const startDate = twoYearsAgo.toISOString().split("T")[0]

    let url = `${TMDB_BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&include_adult=false`

    if (type === "movie") {
      url += `&primary_release_date.gte=${startDate}&primary_release_date.lte=${endDate}`
    } else {
      url += `&first_air_date.gte=${startDate}&first_air_date.lte=${endDate}`
    }

    url += "&with_watch_providers=8&watch_region=FR&vote_count.gte=20"

    const response = await fetchWithRetry(url)
    const data = await response.json()

    const transformedResults = data.results.slice(0, 15).map((item: any) => {
      const title = item.title || item.name
      const releaseDate = item.release_date || item.first_air_date
      const year = releaseDate ? new Date(releaseDate).getFullYear() : "Inconnu"

      const categories = item.genre_ids.map((id: number) => GENRE_MAPPING[id]).filter(Boolean)

      return {
        id: item.id,
        title,
        description: item.overview || "Description non disponible",
        image: item.poster_path ? `${TMDB_IMAGE_BASE_URL}${item.poster_path}` : "/abstract-movie-poster.png",
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        categories,
        year,
        rating: Math.round(item.vote_average * 10) / 10,
        duration: type === "movie" ? "Film" : "Série",
        seasons: type === "tv" ? "Série" : undefined,
        trailer: null,
        cast: [],
        netflixUrl: `https://www.netflix.com/search?q=${encodeURIComponent(title)}`,
        netflixId: undefined,
      }
    })

    return NextResponse.json({
      success: true,
      results: transformedResults,
    })
  } catch (error: any) {
    console.error("Erreur lors de la récupération du contenu qui part:", error)
    return NextResponse.json(
      { success: false, error: `Erreur lors de la récupération du contenu qui part: ${error.message}` },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "movie"

    if (searchParams.get("coming_soon") === "true") {
      return await getComingSoon(type as "movie" | "tv")
    }

    if (searchParams.get("leaving_soon") === "true") {
      return await getLeavingSoon(type as "movie" | "tv")
    }

    const dateRange = searchParams.get("date_range")
    if (dateRange) {
      const [startDate, endDate] = dateRange.split(",")

      let url = `${TMDB_BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=release_date.desc&include_adult=false`

      if (type === "movie") {
        url += `&primary_release_date.gte=${startDate}&primary_release_date.lte=${endDate}`
      } else {
        url += `&first_air_date.gte=${startDate}&first_air_date.lte=${endDate}`
      }

      url += "&with_watch_providers=8&watch_region=FR&vote_count.gte=10"

      try {
        const response = await fetchWithRetry(url)
        const data = await response.json()

        const transformedResults = data.results.slice(0, 20).map((item: any) => {
          const title = item.title || item.name
          const releaseDate = item.release_date || item.first_air_date
          const year = releaseDate ? new Date(releaseDate).getFullYear() : "Inconnu"

          const categories = item.genre_ids.map((id: number) => GENRE_MAPPING[id]).filter(Boolean)

          let seasonsDisplay = undefined
          if (type === "tv") {
            seasonsDisplay = "Série"
          }

          let durationDisplay = undefined
          if (type === "movie") {
            durationDisplay = estimateMovieDuration(item.genre_ids, year as number)
          }

          const netflixUrl = `https://www.netflix.com/search?q=${encodeURIComponent(title)}`

          return {
            id: item.id,
            title,
            description: item.overview || "Description non disponible",
            image: item.poster_path ? `${TMDB_IMAGE_BASE_URL}${item.poster_path}` : "/abstract-movie-poster.png",
            backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
            categories,
            year,
            rating: Math.round(item.vote_average * 10) / 10,
            duration: durationDisplay,
            seasons: seasonsDisplay,
            trailer: null,
            cast: [],
            netflixUrl,
            netflixId: undefined,
            releaseDate: releaseDate,
          }
        })

        return NextResponse.json({
          success: true,
          results: transformedResults,
        })
      } catch (error: any) {
        console.error("Erreur lors de la récupération des nouveautés:", error)
        return NextResponse.json(
          { success: false, error: `Erreur lors de la récupération des nouveautés: ${error.message}` },
          { status: 500 },
        )
      }
    }

    const genre = searchParams.get("genre")
    const contentId = searchParams.get("id")
    const actorQuery = searchParams.get("actor")
    const year = searchParams.get("year")
    const rating = searchParams.get("rating")
    const searchQuery = searchParams.get("search")
    const newReleases = searchParams.get("new_releases") === "true"
    const month = searchParams.get("month")
    const sortBy = searchParams.get("sort_by") || "popularity.desc"
    const limit = searchParams.get("limit") ? Number.parseInt(searchParams.get("limit") as string) : undefined
    const page = searchParams.get("page") ? Number.parseInt(searchParams.get("page") as string) : 1

    if (actorQuery) {
      return await searchContentByActor(actorQuery, type as "movie" | "tv")
    }

    if (searchQuery) {
      return await searchContent(searchQuery, type as "movie" | "tv")
    }

    if (contentId) {
      const result = await getContentDetails(contentId, type as "movie" | "tv")
      return NextResponse.json(result)
    }

    if (newReleases) {
      return await getNewReleases(type as "movie" | "tv", year, month)
    }

    // Construire la clé de cache
    const cacheKey = `${type}-${genre}-${year || "all"}-${rating || "all"}-${sortBy}-${page}`

    // Vérifier le cache
    if (CONTENT_CACHE[cacheKey] && Date.now() - CONTENT_CACHE[cacheKey].timestamp < CACHE_TTL) {
      const cachedResults = CONTENT_CACHE[cacheKey].data
      return NextResponse.json({
        success: true,
        results: limit ? cachedResults.slice(0, limit) : cachedResults,
        total: CONTENT_CACHE[cacheKey].total,
        page: page,
        hasMore: page < CONTENT_CACHE[cacheKey].totalPages,
      })
    }

    // Construire l'URL de base
    let url = `${TMDB_BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=${sortBy}&page=${page}&include_adult=false`

    // IMPORTANT: Filtrer pour le catalogue Netflix France
    url += "&with_watch_providers=8&watch_region=FR"

    // Ajouter le filtre de genre si spécifié
    if (genre && genre !== "all") {
      const genreId = Object.keys(GENRE_MAPPING).find((key) => GENRE_MAPPING[Number.parseInt(key)] === genre)
      if (genreId) {
        url += `&with_genres=${genreId}`
      }
    }

    // Ajouter le filtre d'année si spécifié
    if (year && year !== "all") {
      if (type === "movie") {
        url += `&primary_release_year=${year}`
      } else {
        url += `&first_air_date_year=${year}`
      }
    }

    // Filtrer les contenus avec une note décente ET respecter le filtre utilisateur
    if (rating && rating !== "all") {
      const minRating = Number.parseInt(rating)
      url += `&vote_average.gte=${minRating}&vote_count.gte=50`
    } else {
      url += "&vote_count.gte=50&vote_average.gte=1"
    }

    try {
      const response = await fetchWithRetry(url)
      const data = await response.json()

      // Transformer les données
      const transformedResults = data.results.map((item: any) => {
        const title = item.title || item.name
        const releaseDate = item.release_date || item.first_air_date
        const year = releaseDate ? new Date(releaseDate).getFullYear() : "Inconnu"

        const categories = item.genre_ids.map((id: number) => GENRE_MAPPING[id]).filter(Boolean)

        let seasonsDisplay = undefined
        if (type === "tv") {
          seasonsDisplay = "Série"
        }

        let durationDisplay = undefined
        if (type === "movie") {
          durationDisplay = estimateMovieDuration(item.genre_ids, year as number)
        }

        const netflixUrl = `https://www.netflix.com/search?q=${encodeURIComponent(title)}`

        return {
          id: item.id,
          title,
          description: item.overview || "Description non disponible",
          image: item.poster_path ? `${TMDB_IMAGE_BASE_URL}${item.poster_path}` : "/abstract-movie-poster.png",
          backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
          categories,
          year,
          rating: Math.round(item.vote_average * 10) / 10,
          duration: durationDisplay,
          seasons: seasonsDisplay,
          trailer: null,
          cast: [],
          netflixUrl,
          netflixId: undefined,
        }
      })

      // Mettre en cache les résultats avec les vraies données TMDb
      CONTENT_CACHE[cacheKey] = {
        data: transformedResults,
        timestamp: Date.now(),
        totalPages: data.total_pages || 500,
        total: data.total_results || 0,
      }

      return NextResponse.json({
        success: true,
        results: limit ? transformedResults.slice(0, limit) : transformedResults,
        total: data.total_results || 0,
        page: page,
        hasMore: page < (data.total_pages || 500),
      })
    } catch (error: any) {
      console.error("Erreur lors de la récupération des données:", error)
      return NextResponse.json(
        { success: false, error: `Erreur lors de la récupération des données: ${error.message}` },
        { status: 500 },
      )
    }
  } catch (error: any) {
    console.error("Erreur API:", error)
    return NextResponse.json(
      { success: false, error: `Erreur lors de la récupération des données: ${error.message}` },
      { status: 500 },
    )
  }
}
