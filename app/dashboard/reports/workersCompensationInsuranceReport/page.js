// file: app/dashboard/reports/workersCompensationInsuranceReport/page.js
//고용·산재보험(임금채권부담금 등) 보험료 신고서
"use client";
import { useState } from "react";

export default function WorkersCompensationInsuranceReport() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [formData, setFormData] = useState({
    managementNumber: "",
    constructionName: "",
    companyName: "",
    representative: "",
    address: "",
    phone: "",
    mobile: "",
    fax: "",
    email: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  return (
    <div className="font-sans text-xs m-5 ">
      {/* 제목 */}
      <h1 className="text-center text-lg mb-5">
        ({year})년도 고용·산재보험(임금채권부담금 등) 보험료 신고서
      </h1>

      {/* 신고사업장 테이블 */}
      <table className="w-full border-collapse mb-3">
        <tbody>
          <tr>
            <td className="w-24 text-center bg-gray-100 border border-gray-300" rowSpan="3">
              신고
              <br />
              사업장
            </td>
            <td className="text-left border text-gray-500 border-gray-300 p-1">
              사업장관리번호 :
              <input
                type="text"
                name="managementNumber"
                value={formData.managementNumber}
                onChange={handleChange}
                className="border-b border-gray-300 ml-1 focus:outline-none"
              />
            </td>
            <td className="text-left border border-gray-300 text-gray-500 p-1" colSpan="3">
              공사명(건설공사) :
              <input
                type="text"
                name="constructionName"
                value={formData.constructionName}
                onChange={handleChange}
                className="border-b border-gray-300 ml-1 focus:outline-none"
              />
            </td>
          </tr>
          <tr>
            <td className="text-left border border-gray-300 text-gray-500 p-1">
              사업장명칭 :
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                className="border-b border-gray-300 ml-1 focus:outline-none"
              />
            </td>
            <td className="text-left border border-gray-300 text-gray-500 p-1">
              대표자 :
              <input
                type="text"
                name="representative"
                value={formData.representative}
                onChange={handleChange}
                className="border-b border-gray-300 ml-1 focus:outline-none"
              />
            </td>
            <td className="text-left border border-gray-300  text-gray-500 p-1" colSpan="2">
              소재지 :
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="border-b border-gray-300 ml-1 focus:outline-none"
              />
            </td>
          </tr>
          <tr>
            <td className="text-left border border-gray-300  text-gray-500 p-1">
              전화번호 :
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="border-b border-gray-300 ml-1 focus:outline-none"
              />
            </td>
            <td className="text-left border border-gray-300 text-gray-500  p-1">
              휴대전화 :
              <input
                type="text"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                className="border-b border-gray-300 ml-1 focus:outline-none"
              />
            </td>
            <td className="text-left border border-gray-300 text-gray-500 p-1">
              FAX :
              <input
                type="text"
                name="fax"
                value={formData.fax}
                onChange={handleChange}
                className="border-b border-gray-300 ml-1 focus:outline-none"
              />
            </td>
            <td className="text-left border border-gray-300 text-gray-500 p-1">
              E-mail :
              <input
                type="text"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="border-b border-gray-300 ml-1 focus:outline-none"
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* 확정보험료 테이블 */}
      <table className="w-full border-collapse mb-3">
        <tbody>
          <tr>
            <td className="w-24 text-center bg-gray-100 border border-gray-300" rowSpan="6">
              ({year})년
              <br />
              확정보험료
            </td>
            <td className="text-center border border-gray-300 p-1" colSpan="2" rowSpan="2">
              구분
            </td>
            <td className="text-center border border-gray-300 p-1" rowSpan="2">
              산정기간
            </td>
            <td className="text-center border border-gray-300 p-1" rowSpan="2">
              ①보수총액
            </td>
            <td className="text-center border border-gray-300 p-1" rowSpan="2">
              ②보험료율
            </td>
            <td className="text-center border border-gray-300 p-1" rowSpan="2">
              ③확정보험료액
              <br />
              (①×②)
            </td>
            <td className="text-center border border-gray-300 p-1" colSpan="2">
              개산보험료액
            </td>
            <td className="text-center border border-gray-300 p-1" rowSpan="2">
              ⑥추가납부할
              <br />
              금액(③-④)
            </td>
            <td className="text-center border border-gray-300 p-1" colSpan="2">
              ⑦초과액(⑤-③)
            </td>
          </tr>
          <tr>
            <td className="text-center border border-gray-300 p-1">④신고액</td>
            <td className="text-center border border-gray-300 p-1">⑤납부액</td>
            <td className="text-center border border-gray-300 p-1">충당액</td>
            <td className="text-center border border-gray-300 p-1">반환액</td>
          </tr>
          <tr>
            <td className="text-center border border-gray-300 p-1" colSpan="2">
              산재보험
              <br />
              (임금채권부담금 등 포함)
            </td>
            <td className="text-center border border-gray-300 p-1">~</td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-right border border-gray-300 p-1">/1,000</td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
          </tr>
          <tr>
            <td className="text-center border border-gray-300 p-1 align-middle" rowSpan="3">
              고<br />용<br />보<br />험
            </td>
            <td className="text-center border border-gray-300 p-1">실업급여</td>
            <td className="text-center border border-gray-300 p-1">~</td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-right border border-gray-300 p-1">/1,000</td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
          </tr>
          <tr>
            <td className="text-center border border-gray-300 p-1">
              고용안정·
              <br />
              직업능력개발
            </td>
            <td className="text-center border border-gray-300 p-1">~</td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-right border border-gray-300 p-1">/1,000</td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
          </tr>
          <tr>
            <td className="text-center border border-gray-300 p-1">계</td>
            <td className="text-center border border-gray-300 p-1"></td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1"></td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
            <td className="text-center border border-gray-300 p-1">
              <input type="text" className="w-full p-1 focus:outline-none" />
            </td>
          </tr>
        </tbody>
      </table>

      <div className="flex w-full">
        {/* 개산보험료 테이블 (왼쪽) */}
        <div className="flex-grow mr-1" style={{ flexBasis: "70%" }}>
          <table className="w-full border-collapse mb-3">
            <tbody>
              <tr>
                <td className="w-24 text-center bg-gray-100 border border-gray-300" rowSpan="6">
                  ({year})년
                  <br />
                  개산보험료
                  <br />
                  (추정보험료)
                </td>
                <td className="text-center border border-gray-300 p-1" colSpan="2">
                  구분
                </td>
                <td className="text-center border border-gray-300 p-1">산정기간</td>
                <td className="text-center border border-gray-300 p-1">①보수총액</td>
                <td className="text-center border border-gray-300 p-1">②보험료율</td>
                <td className="text-center border border-gray-300 p-1">
                  ③개산보험료액
                  <br />
                  (①×②)
                </td>
                <td className="text-center border border-gray-300 p-1">
                  ⑪분할납부
                  <br />
                  여부
                </td>
              </tr>
              <tr>
                <td className="text-center border border-gray-300 p-1" colSpan="2">
                  산재보험
                  <br />
                  (임금채권부담금 등 포함)
                </td>
                <td className="text-center border border-gray-300 p-1">
                  <input type="text" className="w-full p-1 focus:outline-none" />
                </td>
                <td className="text-center border border-gray-300 p-1">
                  <input type="text" className="w-full p-1 focus:outline-none" />
                </td>
                <td className="text-right border border-gray-300 p-1">/1,000</td>
                <td className="text-center border border-gray-300 p-1">
                  <input type="text" className="w-full p-1 focus:outline-none" />
                </td>
                <td className="text-center border border-gray-300 p-1">
                  <div className="flex items-center">
                    <input type="checkbox" id="onetime1" className="mr-1" />
                    <label htmlFor="onetime1" className="text-xs">
                      일시납부
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="installment1" className="mr-1" />
                    <label htmlFor="installment1" className="text-xs">
                      분할납부
                    </label>
                  </div>
                </td>
              </tr>
              <tr>
                <td className="text-center border border-gray-300 p-1 align-middle" rowSpan="3">
                  고<br />용<br />보<br />험
                </td>
                <td className="text-center border border-gray-300 p-1">실업급여</td>
                <td className="text-center border border-gray-300 p-1">
                  <input type="text" className="w-full p-1 focus:outline-none" />
                </td>
                <td className="text-center border border-gray-300 p-1">
                  <input type="text" className="w-full p-1 focus:outline-none" />
                </td>
                <td className="text-right border border-gray-300 p-1">/1,000</td>
                <td className="text-center border border-gray-300 p-1">
                  <input type="text" className="w-full p-1 focus:outline-none" />
                </td>
                <td className="text-center border border-gray-300 p-1" rowSpan="3">
                  <div className="flex items-center">
                    <input type="checkbox" id="onetime2" className="mr-1" />
                    <label htmlFor="onetime2" className="text-xs">
                      일시납부
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="installment2" className="mr-1" />
                    <label htmlFor="installment2" className="text-xs">
                      분할납부
                    </label>
                  </div>
                </td>
              </tr>
              <tr>
                <td className="text-center border border-gray-300 p-1">
                  고용안정·
                  <br />
                  직업능력개발
                </td>
                <td className="text-center border border-gray-300 p-1">
                  <input type="text" className="w-full p-1 focus:outline-none" />
                </td>
                <td className="text-center border border-gray-300 p-1">
                  <input type="text" className="w-full p-1 focus:outline-none" />
                </td>
                <td className="text-right border border-gray-300 p-1">/1,000</td>
                <td className="text-center border border-gray-300 p-1">
                  <input type="text" className="w-full p-1 focus:outline-none" />
                </td>
              </tr>
              <tr>
                <td className="text-center border border-gray-300 p-1">계</td>
                <td className="text-center border border-gray-300 p-1"></td>
                <td className="text-center border border-gray-300 p-1">
                  <input type="text" className="w-full p-1 focus:outline-none" />
                </td>
                <td className="text-center border border-gray-300 p-1"></td>
                <td className="text-center border border-gray-300 p-1">
                  <input type="text" className="w-full p-1 focus:outline-none" />
                </td>
              </tr>
              <tr>
                <td className="text-left align-top border border-gray-300 p-1" colSpan="2">
                  ※ 퇴직보험 등에 가입한 사업장은 별도로 부담금 경감신청서를 제출하여
                  임금채권부담금을 경감받으시기 바랍니다.
                </td>
                <td className="text-left align-top border border-gray-300 p-1" colSpan="3">
                  확정보험료 보수총액 대비 개산보험료 보수총액 감소(30% 초과) 사유
                  <br />
                  <div className="flex items-center mt-1">
                    <input type="checkbox" id="reason1" className="mr-1" />
                    <label htmlFor="reason1" className="text-xs">
                      근로자 감소
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="reason2" className="mr-1" />
                    <label htmlFor="reason2" className="text-xs">
                      휴업
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="reason3" className="mr-1" />
                    <label htmlFor="reason3" className="text-xs">
                      그 밖의 사유:
                    </label>
                    <input
                      type="text"
                      className="border-b border-gray-300 ml-1 w-32 focus:outline-none"
                    />
                  </div>
                </td>
                <td className="text-left align-top border border-gray-300 p-1" colSpan="2">
                  ※ 분할납부는 개산보험료로 한정하며, 분할납부를 원하는 경우 뒷면의 분할납부신청서
                  작성
                  <br />※ 일시납부를 하는 경우 3% 할인
                </td>
              </tr>
            </tbody>
          </table>

          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className="border-t border-b border-black p-1 text-left" colSpan="8">
                  「고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률 시행령」 제20조, 제26조
                  및 같은 법 시행규칙 제17조, 제22조제1항에 따라 위와 같이 신고합니다.
                  <br />
                  <br />
                  <div className="text-center">
                    <input type="text" className="w-10 text-center border-b border-gray-300" />{" "}
                    년&nbsp;
                    <input type="text" className="w-6 text-center border-b border-gray-300" />{" "}
                    월&nbsp;
                    <input type="text" className="w-6 text-center border-b border-gray-300" /> 일
                  </div>
                  <div className="text-right">
                    신고인(보험가입자)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(서명
                    또는 인)
                  </div>
                  <div className="text-right">
                    <input type="checkbox" id="agent" className="mr-1" />
                    <label htmlFor="agent">보험사무대행기관</label>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(서명
                    또는 인)
                  </div>
                </td>
              </tr>
              <tr>
                <td className="border-b border-black p-1 text-center font-bold" colSpan="8">
                  <br />
                  근로복지공단 ○○지역본부(지사)장 귀하
                  <br />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 확정보험료 산정 기초 보수 테이블 (오른쪽) */}
        <div className="ml-1" style={{ flexBasis: "30%" }}>
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className="text-center border border-gray-300 p-1" colSpan="5">
                  ({year})년도 확정보험료 산정 기초 보수
                </td>
              </tr>
              <tr>
                <td className="text-center bg-gray-100 border border-gray-300 p-1" rowSpan="2">
                  구분
                </td>
                <td className="text-center bg-gray-100 border border-gray-300 p-1" colSpan="2">
                  산재보험
                </td>
                <td className="text-center bg-gray-100 border border-gray-300 p-1" colSpan="2">
                  고용보험
                </td>
              </tr>
              <tr>
                <td className="text-center bg-gray-100 border border-gray-300 p-1">인원</td>
                <td className="text-center bg-gray-100 border border-gray-300 p-1">보수총액</td>
                <td className="text-center bg-gray-100 border border-gray-300 p-1">인원</td>
                <td className="text-center bg-gray-100 border border-gray-300 p-1">보수총액</td>
              </tr>
              {Array.from({ length: 12 }, (_, i) => (
                <tr key={i}>
                  <td className="text-center border border-gray-300 p-1">{i + 1}월</td>
                  <td className="text-center border border-gray-300 p-1">
                    <input type="text" className="w-8 text-center focus:outline-none" />명
                  </td>
                  <td className="text-center border border-gray-300 p-1">
                    <input type="text" className="w-16 text-center focus:outline-none" />원
                  </td>
                  <td className="text-center border border-gray-300 p-1">
                    <input type="text" className="w-8 text-center focus:outline-none" />명
                  </td>
                  <td className="text-center border border-gray-300 p-1">
                    <input type="text" className="w-16 text-center focus:outline-none" />원
                  </td>
                </tr>
              ))}
              <tr>
                <td className="text-center border border-gray-300 p-1">합계</td>
                <td className="text-center border border-gray-300 p-1">
                  <input type="text" className="w-8 text-center focus:outline-none" />명
                </td>
                <td className="text-center border border-gray-300 p-1">
                  <input type="text" className="w-16 text-center focus:outline-none" />원
                </td>
                <td className="text-center border border-gray-300 p-1">
                  <input type="text" className="w-8 text-center focus:outline-none" />명
                </td>
                <td className="text-center border border-gray-300 p-1">
                  <input type="text" className="w-16 text-center focus:outline-none" />원
                </td>
              </tr>
              <tr>
                <td className="text-center border border-gray-300 p-1">월평균</td>
                <td className="text-center border border-gray-300 p-1">
                  <input type="text" className="w-8 text-center focus:outline-none" />명
                </td>
                <td className="text-center border border-gray-300 p-1">
                  <input type="text" className="w-16 text-center focus:outline-none" />원
                </td>
                <td className="text-center border border-gray-300 p-1">
                  <input type="text" className="w-8 text-center focus:outline-none" />명
                </td>
                <td className="text-center border border-gray-300 p-1">
                  <input type="text" className="w-16 text-center focus:outline-none" />원
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
