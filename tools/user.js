var usersInSingingPart = {
    s1: "#Hazel Hon, #Winifred Lee, #Ivy Wong,  T.Y. Chen, Pauli Lai,  Catherine Li, Winnie Lai, Candy Chik, Zoe Tang,  Elaine Chan, Rebecca Siu, Winnie Yau, Eden Yiu, Maria Li, Kimmy Kam, Tracy Yeung, Stella Lam, Kim Wong, Rebecca Ho, Sandra Tam",
    s2: "#Mary Chu,  Ophelia Chan, Karen Tang, Alice Yeung, Stela Ngo, Mimi Ho, KK Leung, Alison Tsang, Monita Chow, Cecilia Chan, Jane Lai, Lynn Zhang, Eileen Tang",
    a1: "#Shelley Deng,  #Anita Chau, Anita Kwan, Angela Chan, Lily Yeung, Sarah Chan, Ophelia Ng, Fonia Chan",
    a2: "#Yabe Makiko, Gladys Lau, Sue Fung, Joyce Chu, Melody Zhang, Anna Shih, May Chan, Vicki Yu, Ada Wong, Choi-ling Cheung, Ella Chan",
    t1: "#Joe Cheng, #Man-kin Hong, Yiu-chung Wong, Colman Shuen, John Lam, Terry Ching, Jack Kung, Chi-fai Shek, Larry Ho",
    t2: "Patrick Lo, Jack Leung, Charn-wing Ng, Tony Kwong, Akira Cheung, Vinson Ho, Sam Szeto, Jerry So",
    b1: "Mark Li,  Ivan Chan, Willaim Hui, Wally Ho, Cedric Lam,  Brian Yau, Wai-hong Fong, Angus Lee",
    b2: "#Lawrence Lau, Samuel Lui, Sam Lo, Alan Chan, Gary Wong, Jian Sun"
}
users = []
const bcrypt = require("bcrypt");
const mixedGroup = {
    t1: 'T',
    b1: 'B',
    a1: 'A',
    t2: 'T',
    b2: 'B',
    a2: 'A'
}
Object.keys(usersInSingingPart).forEach(singingPart => {
    let userFUllNames = usersInSingingPart[singingPart].replaceAll("#", "").trim().split(",")
    singingPart = Object.keys(mixedGroup).includes(singingPart) ? mixedGroup[singingPart] : singingPart
    singingPart = singingPart.toUpperCase()
    emailHost = ['T', 'B', 'A'].includes(singingPart) ? "yahoo.com" : "gmail.com"
    let saltedpassword = bcrypt.hashSync(`${singingPart}jerry123`, 10)
    users = [...users, ...userFUllNames.map(fullname => {
        return {
            username: fullname.replaceAll(" ", '').replaceAll("-", ""),
            saltedpassword: saltedpassword,
            fullname: fullname,
            email: `hkccticketing.${singingPart}@${emailHost}`,
            singingPart: singingPart,
            verified: false
        }
    })]
})

const {
    writeFile
} = require('fs').promises;
writeFile('users.json',
    JSON.stringify(users), 'utf8', () => {});