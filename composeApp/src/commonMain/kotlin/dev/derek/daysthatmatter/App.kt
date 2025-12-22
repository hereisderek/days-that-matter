package dev.derek.daysthatmatter

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import dev.derek.daysthatmatter.presentation.auth.LoginScreen
import dev.derek.daysthatmatter.presentation.auth.SignUpScreen
import dev.derek.daysthatmatter.presentation.event.EventDetailScreen
import dev.derek.daysthatmatter.presentation.event.EventEditScreen
import dev.derek.daysthatmatter.presentation.home.HomeScreen
import dev.derek.daysthatmatter.presentation.main.MainViewModel
import org.jetbrains.compose.ui.tooling.preview.Preview
import org.koin.compose.viewmodel.koinViewModel

sealed class Screen(val route: String) {
    data object Login : Screen("login")
    data object SignUp : Screen("signup")
    data object Home : Screen("home")
    data object EventEdit : Screen("event_edit/{eventId}") {
        fun createRoute(eventId: String?) = "event_edit/${eventId ?: "new"}"
    }
    data object EventDetail : Screen("event_detail/{eventId}") {
        fun createRoute(eventId: String) = "event_detail/$eventId"
    }
}

@Composable
@Preview
fun App() {
    MaterialTheme {
        val navController = rememberNavController()
        val mainViewModel = koinViewModel<MainViewModel>()
        val currentUser by mainViewModel.currentUser.collectAsStateWithLifecycle()

        // Simple auth guard
        LaunchedEffect(currentUser) {
            if (currentUser != null) {
                // Only navigate if we are on Login or SignUp to avoid resetting navigation on every emission
                val currentRoute = navController.currentBackStackEntry?.destination?.route
                if (currentRoute == Screen.Login.route || currentRoute == Screen.SignUp.route) {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            }
        }

        NavHost(
            navController = navController,
            startDestination = if (currentUser != null) Screen.Home.route else Screen.Login.route
        ) {
            composable(Screen.Login.route) {
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(Screen.Home.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    },
                    onNavigateToSignUp = {
                        navController.navigate(Screen.SignUp.route)
                    }
                )
            }
            composable(Screen.SignUp.route) {
                SignUpScreen(
                    onSignUpSuccess = {
                        navController.navigate(Screen.Home.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    },
                    onNavigateToLogin = {
                        navController.popBackStack()
                    }
                )
            }
            composable(Screen.Home.route) {
                HomeScreen(
                    onNavigateToEventDetail = { eventId ->
                        navController.navigate(Screen.EventDetail.createRoute(eventId))
                    },
                    onNavigateToEventCreate = {
                        navController.navigate(Screen.EventEdit.createRoute(null))
                    }
                )
            }
            composable(Screen.EventEdit.route) { backStackEntry ->
                val eventId = backStackEntry.arguments?.getString("eventId")
                val actualEventId = if (eventId == "new") null else eventId
                EventEditScreen(
                    eventId = actualEventId,
                    onEventSaved = {
                        navController.popBackStack()
                    },
                    onNavigateBack = {
                        navController.popBackStack()
                    }
                )
            }
            composable(Screen.EventDetail.route) { backStackEntry ->
                val eventId = backStackEntry.arguments?.getString("eventId") ?: return@composable
                EventDetailScreen(
                    eventId = eventId,
                    onNavigateBack = {
                        navController.popBackStack()
                    },
                    onNavigateToEdit = { id ->
                        navController.navigate(Screen.EventEdit.createRoute(id))
                    }
                )
            }
        }
    }
}
