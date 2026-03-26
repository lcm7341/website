import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './Home.jsx'
import Content from './Content.jsx'
import Post from './Post.jsx'

function App() {
    return (
        <>
            
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />}/>
                <Route path="/other" element={<Content />}/>
                <Route path="/blog/:year/:month/:day" element={<Post />} />
            </Routes>
        </BrowserRouter>
        </>
    )
}

export default App;